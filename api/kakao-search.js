// api/kakao-search.js
//
// 카카오 로컬 API 프록시 (Vercel 서버리스 함수). 기존 proxy-server.js를
// 대체한다. 브라우저에서 카카오 API를 직접 fetch하면 CORS로 막히기 때문에
// (서버사이드 호출 전제로 설계됨) 이 함수를 거친다. REST API 키는 코드에
// 하드코딩하지 않고 KAKAO_REST_API_KEY 환경변수로 읽는다.

'use strict';

const { setCors, sendJson, handlePreflight } = require('./_utils');

const KAKAO_KEYWORD_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';
const KAKAO_CATEGORY_URL = 'https://dapi.kakao.com/v2/local/search/category.json';

// 클라이언트로부터 그대로 전달해도 되는 파라미터 화이트리스트.
const PASSTHROUGH_PARAMS = [
  'query',
  'category_group_code',
  'x',
  'y',
  'radius',
  'page',
  'size',
];

module.exports = async (req, res) => {
  setCors(res);
  if (handlePreflight(req, res)) return;

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY;
  if (!KAKAO_API_KEY) {
    console.error('[api/kakao-search] KAKAO_REST_API_KEY 환경변수가 설정되어 있지 않습니다.');
    sendJson(res, 500, { error: '서버에 KAKAO_REST_API_KEY가 설정되어 있지 않습니다.' });
    return;
  }

  const query = req.query || {};
  const hasKeyword = typeof query.query === 'string' && query.query.trim() !== '';
  const hasCategory =
    typeof query.category_group_code === 'string' && query.category_group_code.trim() !== '';

  if (!hasKeyword && !hasCategory) {
    sendJson(res, 400, { error: 'query 또는 category_group_code 파라미터가 필요합니다.' });
    return;
  }

  if (!hasKeyword && (!query.x || !query.y)) {
    sendJson(res, 400, { error: '카테고리 검색에는 x, y(및 선택적으로 radius) 파라미터가 필요합니다.' });
    return;
  }

  const targetBase = hasKeyword ? KAKAO_KEYWORD_URL : KAKAO_CATEGORY_URL;
  const targetUrl = new URL(targetBase);

  for (const key of PASSTHROUGH_PARAMS) {
    const value = query[key];
    if (typeof value === 'string' && value !== '') {
      targetUrl.searchParams.set(key, value);
    }
  }

  try {
    const kakaoRes = await fetch(targetUrl, {
      headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
    });
    const text = await kakaoRes.text();
    res.status(kakaoRes.status);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(text);
  } catch (err) {
    console.error('[api/kakao-search] 카카오 API 요청 실패:', err.message);
    sendJson(res, 502, { error: '카카오 API 요청에 실패했습니다.', detail: err.message });
  }
};
