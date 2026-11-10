alter table public.product_variants add column reserved_quantity integer not null default 0
 check(reserved_quantity>=0 and reserved_quantity<=coalesce(stock_quantity,0) and (track_inventory or reserved_quantity=0));
create table public.inventory_reservations (
 order_id uuid not null references public.orders on delete restrict,
 variant_id uuid not null references public.product_variants on delete restrict,
 quantity integer not null check(quantity between 1 and 99),
 created_at timestamptz not null default now(), consumed_at timestamptz,
 primary key(order_id,variant_id)
);
create index inventory_reservations_variant_idx on public.inventory_reservations(variant_id);
alter table public.inventory_reservations enable row level security;
create policy admin_reservation_read on public.inventory_reservations for select to authenticated using ((select shs_private.is_admin()));
revoke all on public.inventory_reservations from anon,authenticated;
grant select on public.inventory_reservations to authenticated;
grant select,insert,update on public.inventory_reservations to service_role;

create function shs_private.reserve_order_line() returns trigger language plpgsql set search_path='' as $$
declare pack record;
begin
 select v.*,p.name product_name,p.slug product_slug into strict pack from public.product_variants v
 join public.products p on p.id=v.product_id where v.id=new.product_variant_id and v.active and p.active for update of v,p;
 if pack.product_id<>new.product_id or pack.weight_grams<>new.weight_grams or pack.price_paise<>new.unit_price_paise
 or new.quantity not between 1 and 99 then raise exception 'Catalogue changed; review cart' using errcode='SH001'; end if;
 new.product_name:=pack.product_name; new.product_slug:=pack.product_slug;
 new.variant_name:=pack.weight_grams::text || ' g';
 if pack.track_inventory then
   if pack.stock_quantity-pack.reserved_quantity<new.quantity then raise exception 'Insufficient available packs' using errcode='SH002'; end if;
   update public.product_variants set reserved_quantity=reserved_quantity+new.quantity where id=pack.id;
   insert into public.inventory_reservations(order_id,variant_id,quantity) values(new.order_id,pack.id,new.quantity);
 end if;
 return new;
end $$;
create trigger reserve_order_line before insert on public.order_items for each row execute function shs_private.reserve_order_line();

create or replace function public.apply_payment_event(
  p_order_id uuid,
  p_provider_event_id text,
  p_event_type text,
  p_target_status text,
  p_provider_payment_id text,
  p_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.orders%rowtype;
  inserted_event_id uuid;
  event_amount integer;
  event_currency text;
  refund_total integer;
  stock_row record;
begin
  if p_target_status not in ('paid', 'failed', 'refunded') then
    raise exception 'Unsupported payment status';
  end if;
  select * into current_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  event_amount := case
    when coalesce(p_payload ->> 'amount', '') ~ '^\d+$' then (p_payload ->> 'amount')::integer
    else null
  end;
  event_currency := nullif(p_payload ->> 'currency', '');

  -- The order lock serializes refund identity checks and state transitions.
  if p_target_status in ('paid', 'refunded') then
    if coalesce(p_payload ->> 'signatureVerified', '') <> 'true'
       or nullif(p_provider_payment_id, '') is null
       or event_currency is distinct from current_order.currency then
      raise exception 'Unverified payment event';
    end if;
    if current_order.razorpay_payment_id is not null
       and current_order.razorpay_payment_id is distinct from p_provider_payment_id then
      raise exception 'Payment does not match the recorded order payment';
    end if;
  end if;

  if p_target_status = 'refunded' then
    if nullif(p_payload ->> 'refundId', '') is null then
      raise exception 'Refund identity required';
    end if;
    if exists (select 1 from public.payment_events
      where order_id = p_order_id and provider_refund_id = p_payload ->> 'refundId') then
      return false;
    end if;
  end if;

  insert into public.payment_events (
    order_id, provider_event_id, event_type, provider_payment_id, resulting_status,
    payload, amount_paise, currency, signature_verified, capture_status, provider_refund_id
  ) values (
    p_order_id, p_provider_event_id, p_event_type, nullif(p_provider_payment_id, ''),
    p_target_status::public.payment_status, coalesce(p_payload, '{}'::jsonb),
    event_amount, event_currency,
    case when p_payload ? 'signatureVerified' then (p_payload ->> 'signatureVerified')::boolean else null end,
    nullif(p_payload ->> 'captureStatus', ''), nullif(p_payload ->> 'refundId', '')
  )
  on conflict (provider_event_id) do nothing
  returning id into inserted_event_id;
  if inserted_event_id is null then return false; end if;

  if p_target_status = 'paid' then
    if event_amount is null or event_amount <> current_order.grand_total_paise or event_currency is distinct from current_order.currency then
      raise exception 'Payment amount or currency mismatch';
    end if;
    if current_order.payment_status = 'paid'
       and current_order.razorpay_payment_id is distinct from nullif(p_provider_payment_id, '') then
      raise exception 'Order already paid with a different payment';
    end if;

    -- A repeated capture must not reverse refunds or resend payment-success email.
    if current_order.payment_status in ('paid', 'refunded') then
      update public.payment_events set resulting_status = current_order.payment_status
      where id = inserted_event_id;
      return false;
    end if;

    if not exists (select 1 from public.inventory_payment_applications where order_id = p_order_id) then
      perform 1
      from public.product_variants v
      join public.order_items oi on oi.product_variant_id = v.id
      where oi.order_id = p_order_id and v.track_inventory
      order by v.id for update of v;

      -- Convert only this order's holds. A later error rolls the whole capture back.
      with consumed as (
        update public.inventory_reservations set consumed_at=now()
        where order_id=p_order_id and consumed_at is null returning variant_id,quantity
      )
      update public.product_variants v set reserved_quantity=v.reserved_quantity-c.quantity
      from consumed c where v.id=c.variant_id;

      if exists (
        select 1
        from public.order_items oi
        join public.product_variants v on v.id = oi.product_variant_id
        where oi.order_id = p_order_id and v.track_inventory
        group by v.id, v.stock_quantity
        having v.stock_quantity is null or v.stock_quantity < sum(oi.quantity)
      ) then
        raise exception 'Insufficient tracked inventory';
      end if;

      for stock_row in
        select v.id, v.stock_quantity, sum(oi.quantity)::integer as sold_quantity
        from public.order_items oi
        join public.product_variants v on v.id = oi.product_variant_id
        where oi.order_id = p_order_id and v.track_inventory
        group by v.id, v.stock_quantity
      loop
        update public.product_variants
        set stock_quantity = stock_row.stock_quantity - stock_row.sold_quantity
        where id = stock_row.id;
        insert into public.inventory_adjustments (
          product_variant_id, order_id, payment_event_id, before_quantity,
          adjustment_delta, after_quantity, reason
        ) values (
          stock_row.id, p_order_id, inserted_event_id, stock_row.stock_quantity,
          -stock_row.sold_quantity, stock_row.stock_quantity - stock_row.sold_quantity,
          'Verified payment inventory decrement'
        );
      end loop;

      insert into public.inventory_payment_applications (order_id, provider_event_id)
      values (p_order_id, p_provider_event_id);
    end if;

    update public.orders
    set payment_status = 'paid',
        razorpay_payment_id = coalesce(razorpay_payment_id, nullif(p_provider_payment_id, '')),
        paid_at = coalesce(paid_at, now()),
        status = case when status = 'pending' then 'confirmed'::public.order_status else status end
    where id = p_order_id;
    if current_order.status = 'pending' then
      insert into public.order_status_history (order_id, status, note)
      values (p_order_id, 'confirmed', 'Payment confirmed.');
    end if;
  elsif p_target_status = 'failed' then
    if current_order.payment_status in ('paid', 'refunded', 'failed') then
      update public.payment_events set resulting_status = current_order.payment_status
      where id = inserted_event_id;
      return false;
    end if;
    update public.orders set payment_status = 'failed' where id = p_order_id;
  elsif p_target_status = 'refunded' then
    if current_order.payment_status not in ('paid', 'refunded') or event_amount is null or event_amount <= 0 then
      raise exception 'Invalid refund event';
    end if;
    refund_total := current_order.refunded_paise + event_amount;
    if refund_total > current_order.grand_total_paise then raise exception 'Refund exceeds payment'; end if;
    update public.orders
    set refunded_paise = refund_total,
        payment_status = case
          when refund_total = grand_total_paise then 'refunded'::public.payment_status
          else 'paid'::public.payment_status
        end
    where id = p_order_id;
    update public.payment_events
    set resulting_status = case
      when refund_total = current_order.grand_total_paise then 'refunded'::public.payment_status
      else 'paid'::public.payment_status
    end
    where id = inserted_event_id;
  end if;
  return true;
end;
$$;


revoke all on function public.apply_payment_event(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_payment_event(uuid, text, text, text, text, jsonb) to service_role;
