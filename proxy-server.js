// proxy-server.js
//
// 카카오 로컬 API는 브라우저에서 직접 fetch하면 CORS로 막히기 때문에
// (서버사이드 호출 전제로 설계됨), 이 저장소에 백엔드가 없는 상태에서
// restaurants.html이 카카오 데이터를 가져올 수 있도록 최소한의 로컬
// 프록시를 둔다. 순수 Node.js 내장 모듈만 사용하며 npm 의존성은 없다.
//
// 실행:
//   $env:KAKAO_REST_API_KEY="..."; node proxy-server.js   (PowerShell)
//   KAKAO_REST_API_KEY=... node proxy-server.js           (bash)

'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = 8787;
const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY;

if (!KAKAO_API_KEY) {
  console.error(
    '[proxy-server] 에러: KAKAO_REST_API_KEY 환경변수가 설정되어 있지 않습니다.\n' +
    '  PowerShell 예시: $env:KAKAO_REST_API_KEY="<REST API KEY>"; node proxy-server.js\n' +
    '  bash 예시:        KAKAO_REST_API_KEY="<REST API KEY>" node proxy-server.js'
  );
  process.exit(1);
}

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

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function proxyToKakao(reqUrl, res) {
  const query = reqUrl.searchParams;
  const hasKeyword = query.has('query') && query.get('query').trim() !== '';
  const hasCategory = query.has('category_group_code') && query.get('category_group_code').trim() !== '';

  if (!hasKeyword && !hasCategory) {
    sendJson(res, 400, { error: 'query 또는 category_group_code 파라미터가 필요합니다.' });
    return;
  }

  // query가 있으면 키워드 검색, 없고 category_group_code만 있으면 카테고리 검색.
  const targetBase = hasKeyword ? KAKAO_KEYWORD_URL : KAKAO_CATEGORY_URL;
  const targetUrl = new URL(targetBase);

  for (const key of PASSTHROUGH_PARAMS) {
    if (query.has(key) && query.get(key) !== '') {
      targetUrl.searchParams.set(key, query.get(key));
    }
  }

  // 카테고리 검색은 위치 파라미터가 필수.
  if (!hasKeyword) {
    if (!targetUrl.searchParams.has('x') || !targetUrl.searchParams.has('y')) {
      sendJson(res, 400, { error: '카테고리 검색에는 x, y(및 선택적으로 radius) 파라미터가 필요합니다.' });
      return;
    }
  }

  const options = {
    headers: {
      Authorization: `KakaoAK ${KAKAO_API_KEY}`,
    },
  };

  https
    .get(targetUrl, options, (kakaoRes) => {
      let data = '';
      kakaoRes.on('data', (chunk) => {
        data += chunk;
      });
      kakaoRes.on('end', () => {
        res.writeHead(kakaoRes.statusCode || 502, {
          'Content-Type': 'application/json; charset=utf-8',
        });
        res.end(data);
      });
    })
    .on('error', (err) => {
      console.error('[proxy-server] 카카오 API 요청 실패:', err.message);
      sendJson(res, 502, { error: '카카오 API 요청에 실패했습니다.', detail: err.message });
    });
}

const server = http.createServer((req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && reqUrl.pathname === '/api/search') {
    proxyToKakao(reqUrl, res);
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`[proxy-server] 카카오 로컬 API 프록시가 http://localhost:${PORT} 에서 대기 중입니다.`);
  console.log(`[proxy-server] 예: http://localhost:${PORT}/api/search?query=강남 파스타`);
});
