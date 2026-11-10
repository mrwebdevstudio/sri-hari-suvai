create table public.notification_outbox (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders on delete restrict,
 event text not null check(event in ('order_confirmation','payment_success','order_processing','order_shipped','order_delivered','order_cancelled')),
 state text not null default 'pending' check(state in('pending','sending','failed','delivered')),
 payload jsonb not null, attempts integer not null default 0 check(attempts>=0), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(order_id,event)
);
alter table public.notification_outbox enable row level security;
create policy internal_notifications on public.notification_outbox for all to anon,authenticated using(false) with check(false);
revoke all on public.notification_outbox from anon,authenticated;
grant select,insert,update on public.notification_outbox to service_role;
create function shs_private.enqueue_order_notice() returns trigger language plpgsql set search_path='' as $$
declare events text[]:='{}'; kind text; settings public.store_settings%rowtype;
begin
 select * into settings from public.store_settings where settings_key='default';
 if tg_op='INSERT' then
   if settings.order_email_hook_enabled then events:=array['order_confirmation']; end if;
 else
   if settings.order_email_hook_enabled and new.payment_status='paid' and old.payment_status<>'paid' then events:=array['payment_success']; end if;
   if settings.shipping_email_hook_enabled and new.status<>old.status and new.status in ('processing','shipped','delivered','cancelled') then
     events:=array_append(events,'order_'||new.status::text);
   end if;
 end if;
 foreach kind in array events loop
   insert into public.notification_outbox(order_id,event,payload) values(new.id,kind,jsonb_strip_nulls(jsonb_build_object(
     'orderNumber',new.order_number,'email',new.email,'amountPaise',new.grand_total_paise,
     'courier',new.courier,'trackingNumber',new.tracking_number,'trackingUrl',new.tracking_url))) on conflict do nothing;
 end loop;
 return new;
end $$;
create trigger order_notices after insert or update of status,payment_status on public.orders
for each row execute function shs_private.enqueue_order_notice();
create function public.claim_order_notice(p_number text,p_event text)
returns table(id uuid,payload jsonb) language sql set search_path='' as $$
 update public.notification_outbox n set state='sending',attempts=attempts+1,updated_at=now()
 from public.orders o where n.order_id=o.id and o.order_number=p_number and n.event=p_event and n.state in ('pending','failed')
 returning n.id,n.payload
$$;
revoke all on function public.claim_order_notice(text,text) from public,anon,authenticated;
grant execute on function public.claim_order_notice(text,text) to service_role;
