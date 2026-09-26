-- ============================================================
-- 천왕봉 죽염 쇼핑몰 DB 스키마 (Supabase SQL Editor에 통째로 붙여넣고 실행)
-- ============================================================

-- 1) 회원 프로필 ------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  phone       text,
  zipcode     text,
  address1    text,
  address2    text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 관리자로 지정할 이메일 (가입하면 자동으로 관리자 권한)
create table if not exists public.admin_emails (email text primary key);
alter table public.admin_emails enable row level security;
-- insert into public.admin_emails (email) values ('관리자이메일@example.com');

-- 가입하면 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, phone, is_admin)
  values (new.id, new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'phone',
          exists (select 1 from public.admin_emails a where lower(a.email) = lower(new.email)));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 관리자 여부 (RLS 정책에서 사용; 본인 여부만 알려주므로 공개 실행 허용)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- 2) 상품 ------------------------------------------------------
create table if not exists public.products (
  id           bigint generated always as identity primary key,
  name         text not null,
  subtitle     text,
  description  text,
  price        integer not null check (price > 0),
  stock        integer not null default 0 check (stock >= 0),
  image_url    text,
  badge        text,
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

-- 3) 주문 ------------------------------------------------------
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_no        text not null unique,          -- 토스 orderId
  user_id         uuid not null references auth.users(id),
  order_name      text not null,
  items_amount    integer not null,
  shipping_fee    integer not null default 0,
  total_amount    integer not null,
  status          text not null default 'pending'
                  check (status in ('pending','awaiting_deposit','paid','preparing','shipped','delivered','cancelled','failed')),
  payment_type    text not null default 'card' check (payment_type in ('card','bank')), -- card=토스, bank=무통장입금
  depositor_name  text,                          -- 무통장입금 입금자명
  deposit_info    jsonb,                         -- 가상계좌 정보 (은행, 계좌번호, 입금기한)
  receiver_name   text not null,
  receiver_phone  text not null,
  zipcode         text not null,
  address1        text not null,
  address2        text,
  memo            text,
  payment_key     text,
  payment_method  text,
  receipt_url     text,
  paid_at         timestamptz,
  tracking_no     text,
  cancel_reason   text,
  created_at      timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders(user_id, created_at desc);

create table if not exists public.order_items (
  id            bigint generated always as identity primary key,
  order_id      uuid not null references public.orders(id) on delete cascade,
  product_id    bigint references public.products(id) on delete set null,
  product_name  text not null,
  unit_price    integer not null,
  quantity      integer not null check (quantity > 0)
);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- 결제 완료 시(카드 승인 / 입금 확인): 상태 변경 + 재고 차감 (서버에서만 호출)
create or replace function public.mark_order_paid(
  p_order_id uuid, p_payment_key text, p_method text, p_receipt_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.orders
     set status = 'paid', payment_key = coalesce(p_payment_key, payment_key),
         payment_method = coalesce(p_method, payment_method),
         receipt_url = coalesce(p_receipt_url, receipt_url), paid_at = now()
   where id = p_order_id and status in ('pending','awaiting_deposit');
  if not found then return; end if;

  update public.products p
     set stock = greatest(p.stock - oi.quantity, 0)
    from public.order_items oi
   where oi.order_id = p_order_id and oi.product_id = p.id;
end $$;

-- 주문 취소: 상태 변경 + (결제 완료였다면) 재고 복구 (서버에서만 호출)
create or replace function public.mark_order_cancelled(p_order_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare prev text;
begin
  select status into prev from public.orders where id = p_order_id for update;
  if prev is null or prev not in ('awaiting_deposit','paid','preparing') then return; end if;

  update public.orders set status = 'cancelled', cancel_reason = p_reason where id = p_order_id;

  -- 재고는 결제 완료 시점에 차감되므로, 입금 대기 주문은 복구할 재고가 없다
  if prev in ('paid','preparing') then
    update public.products p
       set stock = p.stock + oi.quantity
      from public.order_items oi
     where oi.order_id = p_order_id and oi.product_id = p.id;
  end if;
end $$;

revoke execute on function public.mark_order_paid(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.mark_order_cancelled(uuid, text) from public, anon, authenticated;

-- 4) 보안 정책 (RLS) --------------------------------------------
alter table public.profiles    enable row level security;
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- 프로필: 본인 것만 조회/수정, 관리자는 전체 조회
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
-- 회원이 스스로 관리자가 되는 것을 막기 위해 수정 가능한 컬럼을 제한
revoke update on public.profiles from authenticated;
grant update (name, phone, zipcode, address1, address2) on public.profiles to authenticated;

-- 상품: 누구나 판매중 상품 조회, 관리자만 등록/수정/삭제
drop policy if exists "products_select" on public.products;
create policy "products_select" on public.products for select
  using (is_active or public.is_admin());
drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write" on public.products for all
  using (public.is_admin()) with check (public.is_admin());

-- 주문: 본인 주문 조회, 관리자 전체 조회/수정 (생성은 서버에서만)
drop policy if exists "orders_select" on public.orders;
create policy "orders_select" on public.orders for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update" on public.orders for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "order_items_select" on public.order_items;
create policy "order_items_select" on public.order_items for select
  using (exists (select 1 from public.orders o
                  where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));

-- 5) 상품 사진 저장소 --------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert" on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update" on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete" on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());
