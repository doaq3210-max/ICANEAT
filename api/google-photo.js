// api/google-photo.js
//
// Google Places API (New)의 사진 리소스 이름(`places/{placeId}/photos/{photoId}`)을
// 받아 실제 이미지에 접근 가능한 임시 URL(photoUri)을 돌려주는 Vercel 서버리스 함수.
// GOOGLE_PLACES_API_KEY 환경변수 사용, 코드에 하드코딩하지 않는다.
//
// photoUri는 Google이 발급하는 임시(만료성) URL이라 매번 새로 요청해야 하지만,
// 사진 리소스 이름(name) 자체는 만료되지 않으므로 프론트에서 영구 캐시해두고
// 필요할 때만 이 엔드포인트로 photoUri를 재발급받는다.

'use strict';

const { setCors, sendJson, handlePreflight } = require('./_utils');

const PHOTO_NAME_PATTERN = /^places\/[^/]+\/photos\/[^/]+$/;
const MAX_WIDTH_PX = 480;

module.exports = async (req, res) => {
  setCors(res);
  if (handlePreflight(req, res)) return;

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
  if (!GOOGLE_PLACES_API_KEY) {
    console.error('[api/google-photo] GOOGLE_PLACES_API_KEY 환경변수가 설정되어 있지 않습니다.');
    sendJson(res, 500, { error: '서버에 GOOGLE_PLACES_API_KEY가 설정되어 있지 않습니다.' });
    return;
  }

  const query = req.query || {};
  const name = typeof query.name === 'string' ? query.name.trim() : '';

  if (!PHOTO_NAME_PATTERN.test(name)) {
    sendJson(res, 400, { error: 'name 파라미터가 올바른 사진 리소스 이름 형식이 아닙니다.' });
    return;
  }

  const maxWidthPx = Math.min(parseInt(query.maxWidthPx, 10) || MAX_WIDTH_PX, 1600);
  const mediaUrl =
    `https://places.googleapis.com/v1/${name}/media` +
    `?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true&key=${encodeURIComponent(GOOGLE_PLACES_API_KEY)}`;

  try {
    const googleRes = await fetch(mediaUrl);
    const bodyText = await googleRes.text();
    if (!googleRes.ok) {
      console.error('[api/google-photo] Google Places API 오류:', googleRes.status, bodyText);
      sendJson(res, 502, { error: 'Google Places 사진 요청에 실패했습니다.', detail: bodyText });
      return;
    }
    const data = bodyText ? JSON.parse(bodyText) : {};
    sendJson(res, 200, { photoUri: data.photoUri || '' });
  } catch (err) {
    console.error('[api/google-photo] Google Places API 요청 실패:', err.message);
    sendJson(res, 502, { error: 'Google Places 사진 요청에 실패했습니다.', detail: err.message });
  }
};
