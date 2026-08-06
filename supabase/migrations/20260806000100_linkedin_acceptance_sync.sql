-- Aceite de conexao do LinkedIn chega por e-mail (invitations@linkedin.com) e
-- passa a mover o card de Convite pendente para Conexao aceita sem toque
-- manual. O e-mail traz o nome completo no remetente e o cargo com a empresa
-- no corpo; nao traz a URL do perfil, entao o casamento e por nome, com a
-- empresa como desempate.
--
-- A regra segue o contrato do Calendar: nunca escolher entre candidatos
-- ambiguos. Sem match unico o card fica onde esta e a execucao registra o
-- motivo em connection_sync_runs, que existia no schema desde a etapa zero e
-- ate agora nunca havia sido preenchida.

begin;

create or replace function public.sync_linkedin_connection_acceptance(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_message_id text := nullif(btrim(p_payload ->> 'message_id'), '');
  v_full_name text := nullif(btrim(p_payload ->> 'full_name'), '');
  v_headline text := nullif(btrim(p_payload ->> 'headline'), '');
  v_received_at timestamptz := coalesce(
    nullif(btrim(p_payload ->> 'received_at'), '')::timestamptz,
    now()
  );
  v_normalized_name text;
  v_normalized_headline text;
  v_first_name text;
  v_last_name text;
  v_candidate_count integer := 0;
  v_lead_id uuid;
  v_match_method text;
  v_existing_stage public.lead_stage;
begin
  insert into public.connection_sync_runs (status)
  values ('running')
  returning id into v_run_id;

  if v_full_name is null or v_message_id is null then
    update public.connection_sync_runs
       set status = 'failed',
           finished_at = now(),
           error_summary = 'Payload sem message_id ou full_name.'
     where id = v_run_id;
    return jsonb_build_object('run_id', v_run_id, 'status', 'invalid',
      'reason', 'Payload sem message_id ou full_name.');
  end if;

  -- Reprocessar a mesma mensagem nao pode mover o card duas vezes: o Gmail
  -- reentrega, e o n8n repete a execucao quando um no falha depois deste.
  if exists (
    select 1
      from public.lead_activities
     where activity_type = 'connection_accepted'
       and metadata ->> 'linkedin_message_id' = v_message_id
  ) then
    update public.connection_sync_runs
       set status = 'completed', finished_at = now(), accepted_count = 0
     where id = v_run_id;
    return jsonb_build_object('run_id', v_run_id, 'status', 'already_applied',
      'linkedin_message_id', v_message_id);
  end if;

  v_normalized_name := public.normalize_company_name(v_full_name);
  v_normalized_headline := public.normalize_company_name(v_headline);

  -- Um nome de uma palavra so e comum demais para casar com seguranca.
  if v_normalized_name = '' or position(' ' in v_normalized_name) = 0 then
    update public.connection_sync_runs
       set status = 'partial', finished_at = now(), accepted_count = 0,
           error_summary = format('Nome curto demais para casar: %s', v_full_name)
     where id = v_run_id;
    return jsonb_build_object('run_id', v_run_id, 'status', 'unmatched',
      'reason', 'Nome com uma palavra so.', 'full_name', v_full_name);
  end if;

  v_first_name := split_part(v_normalized_name, ' ', 1);
  v_last_name := regexp_replace(v_normalized_name, '^.*\s', '');

  -- Nivel 1: nome completo identico depois de normalizar acento e caixa.
  select count(*)::integer, min(l.id::text)::uuid
    into v_candidate_count, v_lead_id
    from public.leads l
    join public.contacts c on c.id = l.contact_id
   where l.current_stage = 'convite_enviado'
     and public.normalize_company_name(c.full_name) = v_normalized_name;

  if v_candidate_count = 1 then
    v_match_method := 'full_name_exact';
  else
    -- Nivel 2: o LinkedIn costuma trazer nomes do meio que o Apollo nao tem.
    -- Primeiro e ultimo nome iguais, com a empresa do cargo como desempate.
    select count(*)::integer, min(l.id::text)::uuid
      into v_candidate_count, v_lead_id
      from public.leads l
      join public.contacts c on c.id = l.contact_id
      join public.companies company on company.id = l.company_id
     where l.current_stage = 'convite_enviado'
       and position(' ' in public.normalize_company_name(c.full_name)) > 0
       and split_part(public.normalize_company_name(c.full_name), ' ', 1) = v_first_name
       and regexp_replace(public.normalize_company_name(c.full_name), '^.*\s', '') = v_last_name
       and (
         v_normalized_headline is null
         or v_normalized_headline = ''
         or company.normalized_name = ''
         or position(company.normalized_name in v_normalized_headline) > 0
       );

    if v_candidate_count = 1 then
      v_match_method := 'first_last_name_unique';
    end if;
  end if;

  if v_candidate_count <> 1 then
    update public.connection_sync_runs
       set status = 'partial', finished_at = now(), accepted_count = 0,
           error_summary = format(
             '%s candidato(s) em convite_enviado para %s.',
             v_candidate_count, v_full_name
           )
     where id = v_run_id;
    return jsonb_build_object(
      'run_id', v_run_id,
      'status', case when v_candidate_count = 0 then 'unmatched' else 'ambiguous' end,
      'candidates', v_candidate_count,
      'full_name', v_full_name,
      'headline', v_headline
    );
  end if;

  select current_stage into v_existing_stage from public.leads where id = v_lead_id;
  if v_existing_stage <> 'convite_enviado' then
    update public.connection_sync_runs
       set status = 'completed', finished_at = now(), accepted_count = 0
     where id = v_run_id;
    return jsonb_build_object('run_id', v_run_id, 'status', 'already_applied',
      'lead_id', v_lead_id);
  end if;

  update public.leads
     set current_stage = 'conexao_aceita',
         accepted_at = coalesce(accepted_at, v_received_at),
         updated_at = now()
   where id = v_lead_id;

  -- Mesmo activity_type do botao Confirmar aceite, para o historico do card
  -- ler igual venha do e-mail ou da mao.
  insert into public.lead_activities (lead_id, activity_type, summary, metadata)
  values (
    v_lead_id,
    'connection_accepted',
    'Aceite de conexao confirmado pelo e-mail do LinkedIn.',
    jsonb_build_object(
      'source', 'linkedin_email',
      'linkedin_message_id', v_message_id,
      'match_method', v_match_method,
      'linkedin_full_name', v_full_name,
      'linkedin_headline', v_headline,
      'received_at', v_received_at
    )
  );

  update public.connection_sync_runs
     set status = 'completed', finished_at = now(), accepted_count = 1
   where id = v_run_id;

  return jsonb_build_object(
    'run_id', v_run_id,
    'status', 'applied',
    'lead_id', v_lead_id,
    'match_method', v_match_method
  );
end;
$$;

comment on function public.sync_linkedin_connection_acceptance(jsonb) is
  'Move um lead de convite_enviado para conexao_aceita a partir do e-mail de aceite do LinkedIn. Idempotente por message_id e recusa candidatos ambiguos.';

revoke all on function public.sync_linkedin_connection_acceptance(jsonb)
  from public, anon, authenticated;
grant execute on function public.sync_linkedin_connection_acceptance(jsonb)
  to service_role;

commit;
