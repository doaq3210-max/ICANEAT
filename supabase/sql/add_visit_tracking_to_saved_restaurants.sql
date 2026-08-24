-- 맛집주머니(mypage.html)의 방문 여부(가볼곳/가본곳) + 긍부정 평가 + 한줄평 기능을 위한 컬럼.
-- 기존 select/insert/delete RLS는 그대로 두고, 본인 행만 update할 수 있는 정책을 추가한다
-- (RLS를 끄지 않고 update 권한만 최소 범위로 확장).

alter table public.saved_restaurants
  add column visited boolean not null default false,
  add column rating text,
  add column review_text text;

alter table public.saved_restaurants
  add constraint saved_restaurants_rating_check
  check (rating is null or rating in ('또올래요', '글쎄요'));

create policy saved_restaurants_update_own
  on public.saved_restaurants
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
