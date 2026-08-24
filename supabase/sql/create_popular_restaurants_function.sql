-- "인기 랭킹" 기능: saved_restaurants는 RLS로 본인 것만 조회 가능하므로,
-- 누가 담았는지는 절대 노출하지 않고 가게별 담긴 횟수만 집계해 돌려주는
-- 전용 SECURITY DEFINER 함수. saved_restaurants의 RLS 정책은 그대로 둔다.
-- Supabase 대시보드 SQL Editor에서 실행하세요.

create or replace function public.get_popular_restaurants(limit_count int default 5)
returns table(
  place_id text,
  place_name text,
  category_name text,
  address text,
  lat double precision,
  lng double precision,
  save_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with counts as (
    select place_id, count(*) as save_count
    from public.saved_restaurants
    group by place_id
    order by save_count desc, place_id
    limit limit_count
  ),
  latest as (
    select distinct on (place_id)
      place_id, place_name, category_name, address, lat, lng
    from public.saved_restaurants
    order by place_id, created_at desc
  )
  select c.place_id, l.place_name, l.category_name, l.address, l.lat, l.lng, c.save_count
  from counts c
  join latest l using (place_id)
  order by c.save_count desc, c.place_id;
$$;

-- 로그인 여부와 무관하게 메인 화면에서 호출하므로 anon에게도 실행 권한을 준다.
-- 함수 자체가 place_name/count 외 정보(user_id 등)를 절대 반환하지 않으므로 안전하다.
grant execute on function public.get_popular_restaurants(int) to anon, authenticated;
