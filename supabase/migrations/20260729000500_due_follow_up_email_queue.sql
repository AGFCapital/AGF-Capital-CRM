-- Expose only follow-up emails that are due. Future reminders must remain
-- invisible to the delivery workflow until their scheduled timestamp.
create or replace view public.follow_up_email_queue
with (security_invoker = true)
as
select delivery.id as delivery_id,
       delivery.follow_up_id,
       delivery.recipient_profile_id,
       profile.notification_email as recipient_email,
       profile.full_name as recipient_name,
       delivery.scheduled_for,
       delivery.status,
       delivery.attempts,
       follow_up.note,
       company.name as company_name,
       contact.full_name as contact_name,
       lead.id as lead_id
  from public.follow_up_email_deliveries delivery
  join public.lead_follow_ups follow_up on follow_up.id = delivery.follow_up_id
  join public.profiles profile on profile.id = delivery.recipient_profile_id
  join public.leads lead on lead.id = follow_up.lead_id
  join public.companies company on company.id = lead.company_id
  join public.contacts contact on contact.id = lead.contact_id
 where follow_up.status = 'open'
   and profile.follow_up_email_enabled
   and profile.notification_email is not null
   and delivery.status in ('pending', 'failed')
   and delivery.attempts < 3
   and delivery.scheduled_for <= now();

grant select on public.follow_up_email_queue to authenticated, service_role;
