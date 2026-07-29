begin;

update public.lead_import_batches
   set display_name = 'Base Middle-Market 1'
 where file_name = 'apollo-contacts-export (1).csv'
   and display_name = 'apollo-contacts-export (1)';

commit;
