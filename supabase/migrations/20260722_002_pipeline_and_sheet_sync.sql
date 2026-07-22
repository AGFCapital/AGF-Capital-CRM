-- AGF CRM — etapa adicional do pipeline.
-- PostgreSQL não permite usar uma nova opção de enum na mesma transação em
-- que ela é criada; a fila de sincronização está na migração seguinte.

alter type public.lead_stage add value if not exists 'approved' after 'ready_to_send';
