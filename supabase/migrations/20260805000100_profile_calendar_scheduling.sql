-- Agenda individual por operador e vinculo imutavel entre o envio do link e
-- a reserva recebida do Google Calendar.

begin;

alter table public.profiles
  add column if not exists booking_url text,
  add column if not exists calendar_id text,
  add column if not exists calendar_enabled boolean not null default false;

alter table public.profiles
  add constraint profiles_booking_url_check check (
    booking_url is null or booking_url ~* '^https://'
  ),
  add constraint profiles_calendar_id_check check (
    calendar_id is null or btrim(calendar_id) <> ''
  );

create unique index if not exists profiles_calendar_id_unique_idx
  on public.profiles (lower(calendar_id))
  where calendar_id is not null;

-- O projeto de producao ja pode conter usuarios no Auth antes da primeira
-- aplicacao do schema. O trigger cobre apenas novos cadastros, portanto os
-- usuarios preexistentes precisam ser materializados em profiles agora.
insert into public.profiles (
  id,
  full_name,
  notification_email
)
select
  auth_user.id,
  coalesce(
    nullif(auth_user.raw_user_meta_data ->> 'full_name', ''),
    auth_user.email
  ),
  auth_user.email
from auth.users auth_user
on conflict (id) do update
  set full_name = coalesce(public.profiles.full_name, excluded.full_name),
      notification_email = coalesce(
        public.profiles.notification_email,
        excluded.notification_email
      );

-- Mantem o link compartilhado atual como fallback de transicao. Cada socio
-- passa a poder substitui-lo no proprio perfil pela interface.
update public.profiles profile
   set booking_url = nullif(setting.value ->> 'booking_url', ''),
       calendar_enabled = nullif(setting.value ->> 'booking_url', '') is not null
  from public.app_settings setting
 where setting.setting_key = 'calendar_booking'
   and profile.booking_url is null;

alter table public.leads
  add column if not exists scheduling_profile_id uuid
    references public.profiles(id) on delete set null,
  add column if not exists scheduling_booking_url text,
  add column if not exists scheduling_started_at timestamptz;

create index if not exists leads_scheduling_profile_idx
  on public.leads (scheduling_profile_id, current_stage)
  where scheduling_profile_id is not null;

alter table public.calendar_bookings
  add column if not exists host_profile_id uuid
    references public.profiles(id) on delete set null,
  add column if not exists source_calendar_id text;

create index if not exists calendar_bookings_host_profile_idx
  on public.calendar_bookings (host_profile_id, starts_at desc)
  where host_profile_id is not null;

create or replace function public.capture_lead_scheduling_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_url text;
begin
  if new.current_stage = 'agendamento'
     and (
       old.current_stage is distinct from 'agendamento'
       or new.scheduling_profile_id is null
       or new.scheduling_booking_url is null
     ) then
    if new.responsible_id is null then
      raise exception 'Defina um responsavel antes de iniciar o agendamento.';
    end if;

    select nullif(btrim(profile.booking_url), '')
      into v_booking_url
      from public.profiles profile
     where profile.id = new.responsible_id
       and profile.calendar_enabled = true;

    if v_booking_url is null then
      raise exception 'O responsavel do lead precisa configurar seu link de agenda.';
    end if;

    new.scheduling_profile_id := new.responsible_id;
    new.scheduling_booking_url := v_booking_url;
    new.scheduling_started_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists leads_capture_scheduling_context on public.leads;
create trigger leads_capture_scheduling_context
  before update of current_stage on public.leads
  for each row execute function public.capture_lead_scheduling_context();

-- Congela tambem o contexto dos cards que ja estavam em agendamento no
-- momento da migracao, quando o responsavel possui agenda configurada.
update public.leads lead
   set scheduling_profile_id = lead.responsible_id,
       scheduling_booking_url = profile.booking_url,
       scheduling_started_at = coalesce(lead.stage_entered_at, lead.updated_at, now())
  from public.profiles profile
 where lead.current_stage in ('agendamento', 'call_marcada')
   and lead.responsible_id = profile.id
   and profile.calendar_enabled = true
   and profile.booking_url is not null
   and lead.scheduling_profile_id is null;

-- Preserva o sincronizador maduro de ciclo de vida e adiciona uma camada de
-- identificacao do anfitriao. Enquanto o n8n ainda nao enviar a agenda de
-- origem, o payload legado continua aceito; quando enviar, o ownership passa
-- a ser validado de forma estrita e uma divergencia aborta toda a transacao.
alter function public.sync_google_calendar_booking(jsonb)
  rename to sync_google_calendar_booking_core;

revoke all on function public.sync_google_calendar_booking_core(jsonb)
  from public, anon, authenticated, service_role;

create function public.sync_google_calendar_booking(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_booking_id uuid;
  v_lead_id uuid;
  v_host_profile_id uuid;
  v_expected_profile_id uuid;
  v_source_calendar_id text := nullif(lower(btrim(coalesce(
    p_payload ->> 'source_calendar_id',
    p_payload ->> 'calendar_id',
    p_payload #>> '{organizer,email}',
    p_payload #>> '{raw_event,organizer,email}'
  ))), '');
  v_explicit_host text := nullif(btrim(p_payload ->> 'host_profile_id'), '');
begin
  if v_explicit_host is not null then
    begin
      v_host_profile_id := v_explicit_host::uuid;
    exception when invalid_text_representation then
      raise exception 'host_profile_id invalido';
    end;

    if not exists (
      select 1 from public.profiles profile where profile.id = v_host_profile_id
    ) then
      raise exception 'host_profile_id nao corresponde a um perfil do CRM';
    end if;
  elsif v_source_calendar_id is not null then
    select profile.id
      into v_host_profile_id
      from public.profiles profile
     where lower(profile.calendar_id) = v_source_calendar_id
       and profile.calendar_enabled = true;

    if v_host_profile_id is null then
      raise exception 'Agenda de origem nao vinculada a um perfil ativo do CRM: %',
        v_source_calendar_id;
    end if;
  end if;

  v_result := public.sync_google_calendar_booking_core(p_payload);
  v_booking_id := nullif(v_result ->> 'booking_id', '')::uuid;
  v_lead_id := nullif(v_result ->> 'lead_id', '')::uuid;

  if v_host_profile_id is not null and v_lead_id is not null then
    select lead.scheduling_profile_id
      into v_expected_profile_id
      from public.leads lead
     where lead.id = v_lead_id;

    if v_expected_profile_id is null then
      raise exception 'Lead sem responsavel de agendamento registrado';
    end if;

    if v_expected_profile_id <> v_host_profile_id then
      raise exception 'A reserva pertence a outra agenda que nao e a vinculada ao lead';
    end if;
  end if;

  if v_booking_id is not null then
    update public.calendar_bookings
       set host_profile_id = coalesce(v_host_profile_id, host_profile_id),
           source_calendar_id = coalesce(v_source_calendar_id, source_calendar_id),
           updated_at = now()
     where id = v_booking_id;
  end if;

  return v_result || jsonb_build_object(
    'host_profile_id', v_host_profile_id,
    'source_calendar_id', v_source_calendar_id,
    'host_match_status', case
      when v_host_profile_id is null then 'legacy_unscoped'
      else 'matched'
    end
  );
end;
$$;

revoke all on function public.sync_google_calendar_booking(jsonb)
  from public, anon, authenticated;
grant execute on function public.sync_google_calendar_booking(jsonb)
  to service_role;

comment on column public.profiles.booking_url is
  'Link publico individual do Appointment Schedule usado nos leads sob responsabilidade do perfil.';
comment on column public.profiles.calendar_id is
  'Identificador da agenda observado pelo n8n; normalmente o e-mail da agenda Google.';
comment on column public.leads.scheduling_profile_id is
  'Responsavel cuja agenda foi entregue ao lead ao entrar em Agendamento; permanece congelado.';
comment on column public.leads.scheduling_booking_url is
  'Snapshot do link enviado ao lead, preservado mesmo se o perfil alterar sua agenda depois.';

commit;
