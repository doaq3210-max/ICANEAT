# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude Code(claude.ai/code)에게 제공하는 가이드입니다.

## 프로젝트

**I can eat (icaneat)** — 맛집 리뷰/탐색 서비스. 현재 저장소에는 랜딩페이지(정식 출시 전 이메일 사전 신청)와 이를 정의하는 기획 문서만 존재합니다. 백엔드, 빌드 도구, 앱 코드는 아직 없습니다.

- `icaneat_PRD.md` — 서비스 정의, 기능 로드맵(Phase 1~3), 랜딩페이지 섹션 스펙. 스코프와 카피 방향에 대한 소스 오브 트루스로 취급할 것.
- `icaneat_design.md` — 비주얼/디자인 시스템: 무드(미니멀, 셋로그 스타일), 컬러 규칙, 타이포그래피, 레이아웃 레퍼런스(톤은 셋로그, 카드 그리드는 Airbnb 참고).
- `index.html` — 위 두 문서를 기반으로 구현된 실제 랜딩페이지.

랜딩페이지의 카피, 섹션, 비주얼을 변경해달라는 요청을 받으면 먼저 `icaneat_PRD.md`와 `icaneat_design.md`를 확인할 것 — 섹션 순서, 컬러/시간대 로직, 톤 등 이미 내려진 결정들이 담겨 있으므로 임의로 덮어써서는 안 됨.

## 실행 / 프리뷰

`index.html`은 단일 자립형 정적 파일(인라인 CSS + JS, Pretendard 폰트는 CDN `<link>`로 로드)입니다. 별도 빌드 단계는 없습니다. `index.html` 단독 프리뷰라면 `npx --yes serve -l 8765 .` 후 `http://localhost:8765/index.html`을 열어도 됩니다.

다만 `restaurants.html`은 `/api` Vercel 서버리스 함수(카카오/구글 프록시)를 호출하므로, 이 페이지를 포함한 전체 프리뷰는 `npx serve`가 아니라 아래 "맛집 검색" 섹션의 `vercel dev` 플로우를 사용해야 합니다.

이 저장소에는 테스트, 린터, 별도 빌드 명령이 구성되어 있지 않습니다. 배포는 Vercel(정적 파일 + `/api` 서버리스 함수)을 사용합니다.

## 랜딩페이지 구조 (`index.html`)

모든 것이 파일 하나에 들어 있으며 구조는 다음과 같습니다.

1. **`:root`의 CSS 커스텀 프로퍼티**가 디자인 토큰(`--bg`, `--text`, `--accent`, `--accent-soft`, `--accent-strong`, `--neutral`, radius 등)을 정의합니다. `html[data-daypart="dinner"]` 블록이 `--accent*` 토큰들을 오버라이드합니다.
2. **시간대별 액센트 전환**: 파일 하단의 작은 인라인 `<script>`가 로드 시 `new Date().getHours()`를 확인해 `<html>`에 `data-daypart="lunch"`(06:00~17:00, 옅은 오렌지) 또는 `"dinner"`(17:00~06:00, 옅은 하늘색)를 설정합니다. 모든 액센트 컬러는 이 속성 하나로부터 파생되므로, 다른 곳에 오렌지/하늘색을 하드코딩하지 말 것.
3. **섹션 구성**은 PRD 4번 항목 기준 고정 순서: Hero → 핵심 가치(3개 카드) → 기능 미리보기(아이콘+텍스트 카드 그리드, 실제 스크린샷 없이 아이콘이 제품 UI를 대신함) → CTA(이메일만 받는 신청 폼, 프론트단 검증만 있고 백엔드 없음) → FAQ(아코디언) → Footer.
4. **인터랙션 JS**(파일 하단 인라인): FAQ 아코디언 열기/닫기, CTA 폼의 이메일 정규식 검증 + 성공/에러 메시지 상태 표시, 섹션 진입 시 `IntersectionObserver` 기반 `.reveal` 페이드인(`IntersectionObserver` 미지원 시 즉시 보이도록 폴백).

CTA 폼은 의도적으로 서버 연동이 없습니다 — 프론트엔드 전용 플레이스홀더(검증 후 성공 메시지만 표시, 이메일을 저장하거나 전송하지 않음)입니다. Supabase/백엔드 선택은 PRD 로드맵상 아직 미확정이므로, 명확한 제품 결정 없이 실제 제출 로직을 연결하지 말 것.

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

## 맛집 검색 + 구글 리뷰 (`restaurants.html` + `/api`)

`restaurants.html`은 키워드/카테고리로 카카오 로컬 API를 검색해 결과를 카드로 보여주고, 카드를 클릭하면 그리드 아래 고정 패널에 해당 가게의 구글 리뷰(Places API New)를 보여주는 페이지입니다(인라인 CSS+JS, `index.html`의 디자인 토큰을 재사용).

카카오/구글 API는 모두 서버사이드 호출 전제(REST 키 노출 방지, CORS)라 브라우저에서 직접 호출하지 않고 Vercel 서버리스 함수를 거칩니다:

- `api/kakao-search.js` — 카카오 로컬 API 프록시 (`GET /api/kakao-search`, 기존 `proxy-server.js` 대체). `KAKAO_REST_API_KEY` 환경변수 사용.
- `api/google-reviews.js` — 가게 이름+좌표로 Places API (New) `searchText`를 호출해 150m 이내 최적 매칭 1건의 별점/리뷰를 정리해서 반환 (`GET /api/google-reviews?name=&lat=&lng=`). `GOOGLE_PLACES_API_KEY` 환경변수 사용. `locationBias`는 반경을 강제하지 않으므로 응답 후 서버에서 haversine 거리로 150m 초과 후보를 제외한다.
- `api/_utils.js` — 두 함수가 공유하는 CORS/JSON 응답 헬퍼 (파일명이 `_`로 시작해 Vercel이 라우팅하지 않음).

두 REST API 키 모두 코드에 하드코딩하지 않고 환경변수로만 읽습니다.

**로컬 실행**: `.env.example`을 `.env`로 복사해 `KAKAO_REST_API_KEY`, `GOOGLE_PLACES_API_KEY`를 채운 뒤 `npx vercel dev`를 실행합니다. 정적 파일과 `/api` 함수를 동일 코드로 로컬 서빙하므로, 안내되는 포트(보통 `http://localhost:3000`)에서 `restaurants.html`을 엽니다. (기존 `proxy-server.js` + `npx serve` 이원화 방식은 폐기되었습니다.)

**프로덕션(Vercel) 배포**: Vercel 대시보드 → Project Settings → Environment Variables에 `KAKAO_REST_API_KEY`와 `GOOGLE_PLACES_API_KEY`를 등록해야 합니다 — 이 작업은 저장소 코드나 CLI로 대신할 수 없으며 프로젝트 소유자가 Vercel UI에서 직접 해야 합니다. 또한 구글 키의 GCP 프로젝트에서 "Places API (New)"가 활성화되어 있고 결제(billing)가 연결되어 있어야 합니다 — 비활성화 상태면 리뷰 조회가 403으로 실패합니다.

구글 리뷰 조회 결과는 브라우저 `localStorage`에 만료 없이 캐시됩니다(`icaneat:reviews:` 접두사) — 같은 가게를 다시 클릭해도 API를 재호출하지 않습니다.