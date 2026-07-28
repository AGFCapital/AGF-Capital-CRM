begin;

drop function if exists public.lead_pool_dashboard();
drop function if exists public.release_lead_pool(integer);
drop function if exists public.import_lead_pool(text, jsonb, integer, integer, integer);

delete from public.app_settings where setting_key = 'lead_pool_release';

drop table if exists public.lead_pool;
drop table if exists public.lead_import_batches;

commit;
