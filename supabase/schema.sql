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
  info_notice  text,          -- 상품정보제공고시 (한 줄에 "항목: 내용")
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

-- 6) 용량 옵션 ---------------------------------------------------
-- 옵션이 있는 상품은 옵션별 가격·재고로 판매한다 (상품의 price/stock은 최저가·합계로 자동 계산)
create table if not exists public.product_options (
  id          bigint generated always as identity primary key,
  product_id  bigint not null references public.products(id) on delete cascade,
  label       text not null,
  price       integer not null check (price > 0),
  stock       integer not null default 0 check (stock >= 0),
  sort_order  integer not null default 0,
  is_active   boolean not null default true
);
create index if not exists product_options_product_idx on public.product_options(product_id, sort_order);
alter table public.product_options enable row level security;

drop policy if exists "product_options_select" on public.product_options;
create policy "product_options_select" on public.product_options for select
  using ((is_active and exists (select 1 from public.products p where p.id = product_id and p.is_active)) or public.is_admin());
drop policy if exists "product_options_admin_write" on public.product_options;
create policy "product_options_admin_write" on public.product_options for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.order_items add column if not exists option_id bigint references public.product_options(id) on delete set null;
alter table public.order_items add column if not exists option_label text;

-- 비회원 주문
alter table public.orders alter column user_id drop not null;
alter table public.orders add column if not exists orderer_name text;
alter table public.orders add column if not exists orderer_phone text;
alter table public.orders add column if not exists orderer_email text;
create index if not exists orders_guest_lookup_idx on public.orders(order_no, orderer_phone);

-- 결제 완료/취소 시 재고: 옵션이 있으면 옵션 재고, 없으면 상품 재고
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

  update public.product_options o
     set stock = greatest(o.stock - oi.quantity, 0)
    from public.order_items oi
   where oi.order_id = p_order_id and oi.option_id = o.id;
  update public.products p
     set stock = greatest(p.stock - oi.quantity, 0)
    from public.order_items oi
   where oi.order_id = p_order_id and oi.option_id is null and oi.product_id = p.id;
end $$;

create or replace function public.mark_order_cancelled(p_order_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare prev text;
begin
  select status into prev from public.orders where id = p_order_id for update;
  if prev is null or prev not in ('awaiting_deposit','paid','preparing') then return; end if;

  update public.orders set status = 'cancelled', cancel_reason = p_reason where id = p_order_id;

  if prev in ('paid','preparing') then
    update public.product_options o
       set stock = o.stock + oi.quantity
      from public.order_items oi
     where oi.order_id = p_order_id and oi.option_id = o.id;
    update public.products p
       set stock = p.stock + oi.quantity
      from public.order_items oi
     where oi.order_id = p_order_id and oi.option_id is null and oi.product_id = p.id;
  end if;
end $$;

revoke execute on function public.mark_order_paid(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.mark_order_cancelled(uuid, text) from public, anon, authenticated;

-- 7) 구매 후기 ----------------------------------------------------
create table if not exists public.reviews (
  id          bigint generated always as identity primary key,
  product_id  bigint not null references public.products(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  content     text not null check (char_length(content) between 5 and 1000),
  image_url   text,
  author_name text,                -- 가운데를 가린 이름 (박*엽)
  is_hidden   boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (product_id, user_id)
);
create index if not exists reviews_product_idx on public.reviews(product_id, created_at desc);
alter table public.reviews enable row level security;

create or replace function public.has_purchased(p_product_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o join public.order_items oi on oi.order_id = o.id
     where o.user_id = auth.uid() and oi.product_id = p_product_id
       and o.status in ('paid','preparing','shipped','delivered'));
$$;
revoke execute on function public.has_purchased(bigint) from public, anon;
grant execute on function public.has_purchased(bigint) to authenticated;

create or replace function public.reviews_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare n text;
begin
  select coalesce(nullif(trim(name), ''), '고객') into n from public.profiles where id = new.user_id;
  n := coalesce(n, '고객');
  new.author_name := case
    when char_length(n) <= 1 then n
    when char_length(n) = 2 then left(n, 1) || '*'
    else left(n, 1) || repeat('*', char_length(n) - 2) || right(n, 1) end;
  new.is_hidden := false;
  return new;
end $$;
drop trigger if exists reviews_before_insert on public.reviews;
create trigger reviews_before_insert before insert on public.reviews
  for each row execute function public.reviews_before_insert();
revoke execute on function public.reviews_before_insert() from public, anon, authenticated;

drop policy if exists "reviews_select" on public.reviews;
create policy "reviews_select" on public.reviews for select
  using (not is_hidden or user_id = auth.uid() or public.is_admin());
drop policy if exists "reviews_insert" on public.reviews;
create policy "reviews_insert" on public.reviews for insert
  with check (user_id = auth.uid() and public.has_purchased(product_id));
drop policy if exists "reviews_update_own" on public.reviews;
create policy "reviews_update_own" on public.reviews for update
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
drop policy if exists "reviews_delete" on public.reviews;
create policy "reviews_delete" on public.reviews for delete
  using (user_id = auth.uid() or public.is_admin());
revoke update on public.reviews from authenticated;
grant update (rating, content, image_url) on public.reviews to authenticated;

-- 관리자 숨김/보이기
create or replace function public.set_review_hidden(p_id bigint, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요.'; end if;
  update public.reviews set is_hidden = p_hidden where id = p_id;
end $$;
revoke execute on function public.set_review_hidden(bigint, boolean) from public, anon;
grant execute on function public.set_review_hidden(bigint, boolean) to authenticated;

insert into storage.buckets (id, name, public) values ('review-images', 'review-images', true)
on conflict (id) do nothing;
drop policy if exists "review_images_insert" on storage.objects;
create policy "review_images_insert" on storage.objects for insert
  with check (bucket_id = 'review-images' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "review_images_delete" on storage.objects;
create policy "review_images_delete" on storage.objects for delete
  using (bucket_id = 'review-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- 관리자 휴대폰 주문 알림(웹 푸시) 구독 정보. 서버(service role)만 읽고 쓴다
create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- 서버에서만 쓰는 설정값. 푸시 서명 키(vapid_public, vapid_private)를 여기에 넣는다
create table if not exists public.app_secrets (
  key text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
