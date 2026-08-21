// api/google-reviews.js
//
// 가게 이름 + 좌표를 받아 Google Places API (New)의 Text Search로 매칭되는
// 장소를 찾고, 별점/리뷰를 정리해서 돌려주는 Vercel 서버리스 함수.
// GOOGLE_PLACES_API_KEY 환경변수로 키를 읽으며 코드에 하드코딩하지 않는다.
//
// locationBias는 랭킹에만 영향을 줄 뿐 반경을 강제하지 않으므로, 응답을
// 받은 뒤 haversine 거리로 150m(도보 약 2분) 초과 후보를 반드시 제외한다.

'use strict';

const { setCors, sendJson, handlePreflight, haversineMeters } = require('./_utils');

const SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';
const MATCH_RADIUS_M = 150;
const FIELD_MASK =
  'places.id,places.displayName,places.rating,places.userRatingCount,places.reviews,places.googleMapsUri,places.location';

module.exports = async (req, res) => {
  setCors(res);
  if (handlePreflight(req, res)) return;

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
  if (!GOOGLE_PLACES_API_KEY) {
    console.error('[api/google-reviews] GOOGLE_PLACES_API_KEY 환경변수가 설정되어 있지 않습니다.');
    sendJson(res, 500, { error: '서버에 GOOGLE_PLACES_API_KEY가 설정되어 있지 않습니다.' });
    return;
  }

  const query = req.query || {};
  const name = typeof query.name === 'string' ? query.name.trim() : '';
  const lat = parseFloat(query.lat);
  const lng = parseFloat(query.lng);

  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    sendJson(res, 400, { error: 'name, lat, lng 파라미터가 필요합니다.' });
    return;
  }

  let data;
  try {
    const googleRes = await fetch(SEARCH_TEXT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: name,
        languageCode: 'ko',
        regionCode: 'KR',
        maxResultCount: 5,
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: MATCH_RADIUS_M,
          },
        },
      }),
    });

    const bodyText = await googleRes.text();
    if (!googleRes.ok) {
      console.error('[api/google-reviews] Google Places API 오류:', googleRes.status, bodyText);
      sendJson(res, 502, {
        error: 'Google Places API 요청에 실패했습니다.',
        detail: bodyText,
      });
      return;
    }
    data = bodyText ? JSON.parse(bodyText) : {};
  } catch (err) {
    console.error('[api/google-reviews] Google Places API 요청 실패:', err.message);
    sendJson(res, 502, { error: 'Google Places API 요청에 실패했습니다.', detail: err.message });
    return;
  }

  const places = Array.isArray(data.places) ? data.places : [];

  const withinRadius = places
    .filter((place) => place && place.location)
    .map((place) => ({
      place,
      distance: haversineMeters(lat, lng, place.location.latitude, place.location.longitude),
    }))
    .filter((entry) => entry.distance <= MATCH_RADIUS_M)
    .sort((a, b) => a.distance - b.distance);

  if (withinRadius.length === 0) {
    sendJson(res, 200, { found: false });
    return;
  }

  const best = withinRadius[0].place;
  const reviews = (Array.isArray(best.reviews) ? best.reviews : []).map((r) => ({
    author: (r.authorAttribution && r.authorAttribution.displayName) || '익명',
    rating: typeof r.rating === 'number' ? r.rating : null,
    relativeTime: r.relativePublishTimeDescription || '',
    text: (r.text && r.text.text) || (r.originalText && r.originalText.text) || '',
  }));

  sendJson(res, 200, {
    found: true,
    placeId: best.id || '',
    name: (best.displayName && best.displayName.text) || name,
    rating: typeof best.rating === 'number' ? best.rating : null,
    userRatingCount: typeof best.userRatingCount === 'number' ? best.userRatingCount : 0,
    reviews,
    mapsUri: best.googleMapsUri || '',
  });
};
