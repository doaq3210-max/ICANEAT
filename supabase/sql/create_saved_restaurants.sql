-- "담기" 기능: 유저가 저장한 가게 스냅샷을 담는 테이블.
-- Supabase 대시보드 SQL Editor에서 그대로 실행하세요.

create table if not exists public.saved_restaurants (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  place_id      text not null,              -- 카카오 로컬 API 장소 고유 id
  place_name    text not null,
  category_name text,
  address       text,
  lat           double precision,
  lng           double precision,
  created_at    timestamptz not null default now(),

  -- 같은 유저가 같은 가게를 두 번 담는 것을 DB 레벨에서 차단.
  unique (user_id, place_id)
);

create index if not exists saved_restaurants_user_id_idx
  on public.saved_restaurants (user_id);

alter table public.saved_restaurants enable row level security;

-- 본인이 담은 가게만 조회 가능
create policy "saved_restaurants_select_own"
  on public.saved_restaurants
  for select
  to authenticated
  using (auth.uid() = user_id);

-- 본인 명의로만 담기 가능 (user_id는 default auth.uid()로 자동 채워짐)
create policy "saved_restaurants_insert_own"
  on public.saved_restaurants
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 본인이 담은 가게만 취소(삭제) 가능
create policy "saved_restaurants_delete_own"
  on public.saved_restaurants
  for delete
  to authenticated
  using (auth.uid() = user_id);
