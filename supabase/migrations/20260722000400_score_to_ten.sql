-- AGF CRM — pontuação comercial em escala de 0 a 10.
-- Base: porte (0-3) + urgência/momento (0-3) + decisor (0-2).
-- Bônus de economia real: 0-2, sendo +2 fora do eixo Rio-São Paulo
-- e +1 dentro do eixo. Os cortes mínimos continuam sendo aplicados
-- sobre o score-base, antes do bônus.

alter table public.leads
  drop constraint if exists leads_real_economy_bonus_check;

alter table public.leads
  add constraint leads_real_economy_bonus_check
  check (real_economy_bonus between 0 and 2);

update public.criteria_versions
set rules = jsonb_set(
  jsonb_set(
    rules,
    '{vacancy,score,economia_real}',
    '"0-2"'::jsonb,
    true
  ),
  '{middle_market,score,economia_real}',
  '"0-2"'::jsonb,
  true
)
where version = 1;

insert into public.app_settings (setting_key, description, value)
values (
  'scoring',
  'Escala comercial e bônus para economia real.',
  '{"maximum_score":10,"real_economy":{"outside_rio_sao_paulo":2,"rio_sao_paulo":1,"other":0},"vacancy_base_threshold":3,"middle_market_base_threshold":5}'::jsonb
)
on conflict (setting_key) do update
set value = excluded.value,
    description = excluded.description,
    updated_at = now();
