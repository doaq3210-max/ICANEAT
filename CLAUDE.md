# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude Code(claude.ai/code)에게 제공하는 가이드입니다.

## 프로젝트

**I can eat (icaneat)** — 맛집 검색/리뷰 서비스. `icaneat_PRD.md`/`icaneat_design.md`는 v0.1(정식 출시 전 이메일 사전 신청 랜딩페이지) 시점 기획 문서지만, 그 이후 카카오 검색·구글 리뷰·Gemini AI 분석이 실제로 구현되어 "사전 신청" 전제는 더 이상 유효하지 않습니다. 디자인 톤·컬러 2톤 원칙·섹션 내 카드형 레이아웃 등 **비주얼 디자인 결정**은 여전히 두 문서를 소스 오브 트루스로 취급하되, 카피/섹션 구성은 실제 구현 상태를 우선한다.

- `icaneat_PRD.md` / `icaneat_design.md` — 기획 배경, 디자인 무드·컬러·타이포그래피 원칙(톤은 셋로그, 카드 그리드는 Airbnb 참고). 새 비주얼 작업 시 참고.
- `index.html` — 홈. 히어로 + 인기 랭킹 + 맞춤 추천 + 맛집 검색창. 인기 랭킹/맞춤 추천 카드는 restaurants.html과 동일하게 클릭 시 구글 리뷰/AI 분석 모달 + 담기 버튼을 갖는다(`restaurant-card.js` 재사용).
- `about.html` — 서비스 소개(핵심 가치, 기능 미리보기 — 이용 가능/준비 중 구분, FAQ).
- `restaurants.html` — 카카오 검색 결과(음식점/카페+디저트/주점 필터 + 하위 카테고리) + 클릭 시 구글 리뷰/AI 분석 팝업 + 담기 버튼.
- `mypage.html` — 맛집주머니(가볼곳/가본곳으로 나뉜 내가 담은 가게 목록, 카드 클릭 시 방문여부·평가·한줄평을 남기는 내 기록 모달, 삭제 가능).
- `api/` — `restaurants.html`이 쓰는 Vercel 서버리스 함수(카카오/구글/제미나이 프록시). 자세한 내용은 아래 "맛집 검색 + 구글 리뷰" 섹션 참고.
- `auth.js` / `auth.css` — 네 페이지가 공유하는 Supabase 로그인 모듈. 자세한 내용은 아래 "로그인 (Supabase Auth)" 섹션 참고.
- `restaurant-card.js` / `restaurant-card.css` — `index.html`과 `restaurants.html`이 공유하는 맛집 카드 렌더링 + 구글 리뷰/AI 분석 모달 + 담기 토글 모듈. 자세한 내용은 아래 "맛집 검색 + 구글 리뷰" 섹션 참고.

랜딩페이지의 비주얼(컬러/타이포/톤)을 변경해달라는 요청을 받으면 `icaneat_design.md`를 확인할 것. 카피/섹션 구성 변경은 문서보다 실제 구현 상태와 사용자 지시를 우선한다.

## 실행 / 프리뷰

`index.html`은 단일 자립형 정적 파일(인라인 CSS + JS, Pretendard 폰트는 CDN `<link>`로 로드)입니다. 별도 빌드 단계는 없습니다. `index.html` 단독 프리뷰라면 `npx --yes serve -l 8765 .` 후 `http://localhost:8765/index.html`을 열어도 됩니다.

다만 `restaurants.html`과 `index.html`(맞춤 추천 검색, 인기 랭킹/맞춤 추천 카드의 리뷰·AI 분석 모달)은 `/api` Vercel 서버리스 함수(카카오/구글/제미나이 프록시)를 호출하므로, 이 페이지들을 포함한 전체 프리뷰는 `npx serve`가 아니라 아래 "맛집 검색 + 구글 리뷰" 섹션의 `vercel dev` 플로우를 사용해야 합니다.

이 저장소에는 테스트, 린터, 별도 빌드 명령이 구성되어 있지 않습니다. 배포는 Vercel(정적 파일 + `/api` 서버리스 함수)을 사용합니다.

## `index.html` / `about.html` 구조

각각 단일 자립형 파일(인라인 CSS+JS, `:root` 디자인 토큰 재선언, Pretendard 폰트는 CDN `<link>`로 로드)입니다. 두 파일 모두 파일 하단 인라인 `<script>`에서 `new Date().getHours()`로 `<html data-daypart="lunch|dinner">`를 설정하고, 모든 `--accent*` 토큰이 이 속성 하나로부터 파생됩니다 — 다른 곳에 오렌지/하늘색을 하드코딩하지 말 것.

- **`index.html`**: 헤더(로고 + 로그인 시에만 보이는 `맛집주머니` 버튼 + `about.html`로 가는 `about` 버튼) → 히어로(서비스 한 줄 소개 + 비주얼) → **검색 툴바**(`id="search"`, 구글/네이버 스타일의 가로로 긴 알약형 인풋+원형 검색 버튼 하나만 있는 미니멀한 형태 — 큰 CTA 박스가 아니다. 제출하면 `restaurants.html?q=<검색어>`로 이동) → **인기 랭킹**(`id="ranking"`, 로그인 여부와 무관하게 노출 — 아래 "인기 랭킹 / 맞춤 추천" 섹션 참고) → **맞춤 추천**(`id="recoSection"`, 로그인 후 추천 결과가 있을 때만 노출) → 푸터. 인기 랭킹/맞춤 추천 카드는 `restaurant-card.js`가 제공하는 `.rest-card` 컴포넌트를 그대로 사용해 클릭 시 리뷰/AI분석 모달과 담기 버튼을 갖는다 — 아래 "맛집 검색 + 구글 리뷰" 섹션 참고. 예전에는 헤더+히어로+검색 CTA+푸터 4개만 두고 다른 섹션 추가를 금지했었지만, 인기 랭킹/맞춤 추천을 메인 화면에 노출해달라는 요청에 따라 그 규칙은 폐기되었다 — 이제 메인 화면에 새 섹션을 추가하는 것 자체는 막혀있지 않다(다만 무분별하게 늘리지 말고 필요성을 먼저 판단할 것). 검색 툴바를 히어로 바로 아래·인기 랭킹보다 위에 두는 배치도 명시적 요청에 따른 것이므로 임의로 다시 아래로 옮기지 말 것.
- **`about.html`**: 헤더(로고는 `index.html`로, 우측 버튼은 `index.html#search`로) → 핵심 가치 3카드 → 기능 미리보기 6카드(각 카드에 `이용 가능`/`준비 중` 배지 — 실제 구현 상태와 배지가 어긋나지 않도록 기능을 새로 구현/제거할 때 함께 갱신할 것, 스크린샷 대신 아이콘+텍스트 유지) → FAQ(아코디언) → 푸터.
- **인터랙션**: `about.html`에 FAQ 아코디언 토글 로직이 있음(`index.html`에는 FAQ가 없으므로 해당 로직 없음). 두 파일 모두 섹션 진입 시 `IntersectionObserver` 기반 `.reveal` 페이드인(미지원 시 즉시 보이도록 폴백).

## 유지해야 할 디자인 제약

- 배경은 시간대와 무관하게 항상 화이트/오프화이트 유지 — 액센트(버튼, 태그, 아이콘 칩, 히어로 블롭)만 점심/저녁 톤 사이에서 전환됨.
- 액센트 컬러는 낮은 채도/파스텔 톤을 유지하고 세 번째 브랜드 컬러를 추가하지 말 것 — PRD가 팔레트를 시간대 기반 2톤으로 명시적으로 제한함.
- 무거운 그림자/그라데이션이나 과한 모션은 지양 — 디자인 문서는 절제되고 미니멀한 마이크로 인터랙션(셋로그 레퍼런스)을 요구하며 화려한 효과를 원하지 않음.
- 기능 미리보기 카드는 실제 제품 UI가 아직 없으므로 스크린샷이 아닌 아이콘 + 짧은 텍스트를 사용할 것.

## 반응형
 - 모바일(345)
 - 태블릿(768)
 - 데스크탑(1440)
 - 으로 브레이크포인트 설정

## 맛집 검색 + 구글 리뷰 (`restaurants.html` + `index.html` + `restaurant-card.js`/`.css` + `/api`)

`restaurants.html`은 URL에 `?q=<검색어>`가 있으면(예: `index.html` 검색창에서 넘어온 경우) 그 검색어로 바로 키워드 검색을 실행하고, 없으면 기존처럼 위치 기반 기본 카테고리 검색을 보여줍니다. 카테고리 필터는 **음식점 / 카페+디저트 / 주점** 3그룹이며("전체" 옵션은 없음, 기본 선택은 음식점), 음식점 선택 시 한식/중식/일식/양식/아시아/남미·하와이/분식/퓨전/기타 9개, 카페+디저트 선택 시 커피/베이커리/빙수+아이스크림 3개의 하위 카테고리 칩이 그 아래에 나타납니다(주점은 하위 카테고리 없음). 카카오 로컬 API에는 이 하위 카테고리나 '주점' 전용 `category_group_code`가 없으므로(음식점=FD6, 카페=CE7만 존재), 하위 카테고리/주점은 `category_group_code`(FD6 또는 CE7)에 검색 키워드(`query`)를 함께 보내 결과를 좁히는 방식으로 구현되어 있습니다(`restaurants.html`의 `CATEGORY_GROUPS` 설정 참고) — 카카오의 텍스트 관련도 기반 근사치이지 정확한 카테고리 매칭은 아닙니다.

맛집 카드 렌더링(`renderCard`) + 클릭 시 뜨는 구글 리뷰(Places API New)/Gemini AI 분석 모달 + "담기" 토글 로직은 `restaurant-card.js`/`restaurant-card.css`라는 공용 모듈로 분리되어 있고, `restaurants.html`의 검색 결과 카드와 `index.html`의 인기 랭킹/맞춤 추천 카드가 동일하게 이 모듈을 사용합니다. 사용법은 `window.icaneatCard.renderCard(doc)`로 카드 DOM을 만들고, 카드를 담는 컨테이너마다 `window.icaneatCard.mount(container)`를 한 번 호출해 담기 버튼/카드 클릭(리뷰 모달) 이벤트 위임을 등록하는 식이다(여러 컨테이너를 동시에 mount할 수 있고, 담기 상태는 전역으로 동기화된다). 리뷰 모달의 DOM은 첫 사용 시 모듈이 `document.body`에 직접 주입하므로 호스트 페이지 쪽에 모달 마크업을 따로 둘 필요가 없다. `index.html`의 인기 랭킹은 `get_popular_restaurants` RPC 행(`place_id`/`place_name`/`category_name`/`address`/`lat`/`lng`)을 카카오 doc과 같은 필드 이름(`id`/`place_name`/`category_name`/`road_address_name`/`x`/`y`)으로 매핑해서 `renderCard()`에 넘기고(순위 배지·"N명이 담았어요" 카운트는 index.html이 렌더링된 카드에 추가로 얹는다), 맞춤 추천은 카카오 검색 결과 doc을 그대로 넘긴다.

리뷰가 있으면 모달이 이어서 AI 분석을 요청해 감정 분류 비율(긍정/보통/부정), 핵심 키워드 워드클라우드, 한 줄 총평을 보여줍니다. 긴 리뷰 본문은 "...더보기"로 접혀 있다가 클릭 시 펼쳐지며, 팝업은 배경 클릭/닫기 버튼/Esc로 닫을 수 있습니다. 워드클라우드는 CDN으로 로드하는 `wordcloud` 라이브러리(`wordcloud2.js`)를 사용하며, `restaurant-card.js`를 쓰는 `index.html`과 `restaurants.html` 양쪽 모두 이 CDN 스크립트를 로드합니다.

카카오/구글/제미나이 API는 모두 서버사이드 호출 전제(REST 키 노출 방지, CORS)라 브라우저에서 직접 호출하지 않고 Vercel 서버리스 함수를 거칩니다:

- `api/kakao-search.js` — 카카오 로컬 API 프록시 (`GET /api/kakao-search`, 기존 `proxy-server.js` 대체). `KAKAO_REST_API_KEY` 환경변수 사용.
- `api/google-reviews.js` — 가게 이름+좌표로 Places API (New) `searchText`를 호출해 150m 이내 최적 매칭 1건의 별점/리뷰를 정리해서 반환 (`GET /api/google-reviews?name=&lat=&lng=`). `GOOGLE_PLACES_API_KEY` 환경변수 사용. `locationBias`는 반경을 강제하지 않으므로 응답 후 서버에서 haversine 거리로 150m 초과 후보를 제외한다.
- `api/ai-analyze.js` — 구글 리뷰 텍스트를 Gemini(`gemini-3.6-flash`, structured output)에 보내 감정 분류 집계·핵심 키워드·한 줄 요약을 받아온다 (`POST /api/ai-analyze`, body `{name, reviews}`). `GEMINI_API_KEY` 환경변수 사용. 리뷰가 0개인 가게는 프론트에서 아예 호출하지 않는다.
- `api/_utils.js` — 세 함수가 공유하는 CORS/JSON 응답 헬퍼 (파일명이 `_`로 시작해 Vercel이 라우팅하지 않음).

세 REST API 키 모두 코드에 하드코딩하지 않고 환경변수로만 읽습니다.

**로컬 실행**: `.env.example`을 `.env`로 복사해 `KAKAO_REST_API_KEY`, `GOOGLE_PLACES_API_KEY`, `GEMINI_API_KEY`를 채운 뒤 `npx vercel dev`를 실행합니다. 정적 파일과 `/api` 함수를 동일 코드로 로컬 서빙하므로, 안내되는 포트(보통 `http://localhost:3000`)에서 `restaurants.html`을 엽니다. (기존 `proxy-server.js` + `npx serve` 이원화 방식은 폐기되었습니다.)

**프로덕션(Vercel) 배포**: Vercel 대시보드 → Project Settings → Environment Variables에 `KAKAO_REST_API_KEY`, `GOOGLE_PLACES_API_KEY`, `GEMINI_API_KEY`를 등록해야 합니다 — 이 작업은 저장소 코드나 CLI로 대신할 수 없으며 프로젝트 소유자가 Vercel UI에서 직접 해야 합니다. 또한 구글 키의 GCP 프로젝트에서 "Places API (New)"가 활성화되어 있고 결제(billing)가 연결되어 있어야 합니다 — 비활성화 상태면 리뷰 조회가 403으로 실패합니다.

구글 리뷰 조회 결과와 AI 분석 결과 모두 브라우저 `localStorage`에 만료 없이 캐시됩니다(각각 `icaneat:reviews:`, `icaneat:ai:` 접두사) — 같은 가게를 다시 클릭해도 API를 재호출하지 않습니다.

## 로그인 (Supabase Auth)

`auth.js`/`auth.css`는 `index.html`/`about.html`/`restaurants.html`/`mypage.html` 네 페이지가 동일하게 `<link>`/`<script>`로 불러와 쓰는 공용 파일이다. `restaurant-card.js`/`restaurant-card.css`는 `index.html`과 `restaurants.html`이 공유하는 두 번째 공용 파일 쌍이다(맛집 카드 렌더링 + 구글 리뷰/AI 분석 모달 + 담기 토글 — 아래 "맛집 검색 + 구글 리뷰" 섹션 참고). 이 두 쌍을 제외하면 각 페이지가 자립형이다 — 위 원칙 참고. Supabase 이메일/비밀번호 로그인을 `@supabase/supabase-js` CDN(`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`)으로 붙였고, 비밀번호 해싱·세션 저장 등 보안 관련 로직은 전혀 직접 구현하지 않고 전부 Supabase에 맡긴다.

- `auth.js`는 각 페이지의 `<div id="authSlot"></div>`(헤더의 `.header-actions` 안, 기존 nav 버튼 오른쪽)에 로그인 버튼 또는 `{이메일 앞부분}님 로그아웃`을 주입하고, 로그인/회원가입 모달(이메일+비밀번호, 에러는 한국어로 매핑)을 관리한다. Supabase Project URL과 Publishable key(`sb_publishable_...`)는 브라우저 노출이 전제된 공개 키라 `auth.js`에 직접 하드코딩되어 있다 — 카카오/구글/제미나이 REST 키처럼 서버 프록시가 필요 없다.
- 다른 기능이 로그인 여부를 확인/요구할 때 쓰는 공개 인터페이스: `window.icaneatAuth.getUser()`(현재 유저 또는 `null`), `.onChange(cb)`(상태 변화 구독), `.requireLogin()`(비로그인 시 모달만 열고 `false` 반환, 로그인 상태면 `true`), `.signOut()`. `restaurants.html`의 "담기" 버튼, `index.html`/`restaurants.html`의 "맛집주머니" 네비 버튼, `mypage.html` 페이지 전체가 이 인터페이스로 로그인을 게이팅한다.
- **Supabase 프로젝트 대시보드에서 "Confirm email"을 꺼둬야** 회원가입 시 이메일 인증 대기 없이 바로 로그인된다(Authentication → Sign In / Providers → Email). 이 설정은 MCP로 제공되는 Supabase 도구 목록에 없어 대시보드에서 직접 켜고 꺼야 한다.
- Supabase MCP 서버(`claude mcp add --transport http supabase https://mcp.supabase.com/mcp`)가 연결되어 있으면 `list_tables`/`get_advisors`/`execute_sql` 등으로 프로젝트를 직접 조회·조작할 수 있다.

## 맛집 담기 / 맛집주머니 / 인기 랭킹 / 맞춤 추천 (Supabase `saved_restaurants`)

- **테이블**: `public.saved_restaurants` (`supabase/sql/create_saved_restaurants.sql` + `supabase/sql/add_visit_tracking_to_saved_restaurants.sql`). 컬럼은 `user_id`(`auth.uid()` 기본값) + 담을 당시 스냅샷(`place_id`, `place_name`, `category_name`, `address`, `lat`, `lng`) + `created_at` + 방문 기록(`visited` boolean, 기본 `false`; `rating` text, `'또올래요'`/`'글쎄요'`/`null`만 허용하는 check 제약; `review_text` text, 한줄평). `unique (user_id, place_id)`로 같은 유저가 같은 가게를 두 번 담는 것을 DB 레벨에서 막고, RLS로 본인 행만 select/insert/update/delete 가능 — **이 RLS는 어떤 기능을 추가하든 끄지 말 것**.
- **담기 버튼** (`restaurant-card.js`, `index.html`/`restaurants.html` 공용): `window.icaneatAuth.getClient()`로 기존 Supabase 클라이언트를 재사용해 insert/delete 토글. 비로그인 시 `requireLogin()`으로 로그인 모달만 열고 실제 담기는 막는다.
- **맛집주머니** (`mypage.html`): 로그인한 유저의 `saved_restaurants`를 `created_at desc`로 조회해 `visited` 값에 따라 **가볼곳**/**가본곳** 두 그룹으로 나눠 카드로 나열한다. 각 카드의 "가봤어요"/"안가봤어요" 버튼을 누르면 모달 없이 즉시 `visited`를 update하고 카드를 반대 그룹으로 옮긴다. 카드 본문(삭제 버튼·방문 토글 버튼·구글맵 링크 제외)을 클릭하면 이 페이지 전용 "내 기록" 모달이 열려 평가(또올래요/글쎄요 중 선택, 같은 걸 다시 누르면 해제)와 한줄평을 입력·수정하고 저장할 수 있다 — restaurants.html/index.html 쪽 모달과 달리 구글 리뷰·AI 분석은 다루지 않는, mypage.html 전용의 가벼운 모달이다(`restaurant-card.js`를 재사용하지 않음). 카드별 삭제(X)도 그대로 가능. `index.html`/`restaurants.html` 헤더의 "맛집주머니" 버튼(로그인 안 된 상태로 클릭하면 이동 대신 로그인 모달 오픈)에서 진입.
- **인기 랭킹** (`index.html` `#ranking`, 로그인 여부 무관 노출): `saved_restaurants`는 RLS 때문에 다른 유저 행을 직접 집계할 수 없으므로, `public.get_popular_restaurants(limit_count int)`라는 `SECURITY DEFINER` Postgres 함수(`supabase/sql/create_popular_restaurants_function.sql`)를 통해서만 top N을 가져온다. 이 함수는 `place_id`별 개수와 가장 최근 스냅샷(이름/카테고리/주소/좌표)만 반환하고 **누가 담았는지는 절대 반환하지 않는다** — RLS를 끄는 대신 이 "전용 창구" 함수로 우회하는 패턴이므로, 다른 집계 기능이 필요해도 이 방식(별도 `SECURITY DEFINER` 함수 + 최소 컬럼만 반환)을 따를 것. 프론트에서는 `getClient().rpc('get_popular_restaurants', { limit_count: 5 })`로 호출한다.
- **맞춤 추천** (`index.html` `#recoSection`, 로그인 시에만 노출): 본인 `saved_restaurants`는 RLS로 이미 조회 가능하므로 별도 함수 없이 직접 select. `category_name`(카카오 형식 `"음식점 > 한식 > 육류,고기"`)에서 두 번째 세그먼트(대분류, 예 `한식`)를 뽑아 가장 자주 담은 카테고리를 구하고, 그 키워드로 `/api/kakao-search`를 실시간 검색해서 이미 담은 `place_id`를 제외한 결과를 보여준다 — 추천 목록은 저장된 테이블이 아니라 매번 라이브 카카오 검색 결과다.
- 개발/데모용 더미 데이터(`dummy-001`~`dummy-065` place_id, 100행)가 실제 가입 유저 3명에게 분산 삽입되어 있다 — 실제 서비스 데이터가 아니므로 정리가 필요하면 `place_id like 'dummy-%'` 조건으로 걸러서 지울 것.