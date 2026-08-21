// api/ai-analyze.js
//
// 이미 받아온 구글 리뷰 텍스트를 Gemini에 보내 (1) 긍정/보통/부정 분류·집계,
// (2) 핵심 키워드(중요도 점수 + 긍/부정 맥락), (3) 한 줄 총평을 뽑아낸다.
// GEMINI_API_KEY 환경변수로 키를 읽으며 코드에 하드코딩하지 않는다.

'use strict';

const { setCors, sendJson, handlePreflight } = require('./_utils');

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    sentiment: {
      type: 'OBJECT',
      properties: {
        positive: { type: 'INTEGER' },
        neutral: { type: 'INTEGER' },
        negative: { type: 'INTEGER' },
      },
      required: ['positive', 'neutral', 'negative'],
    },
    keywords: {
      type: 'ARRAY',
      maxItems: 15,
      items: {
        type: 'OBJECT',
        properties: {
          word: { type: 'STRING' },
          score: { type: 'INTEGER' },
          sentiment: { type: 'STRING', enum: ['positive', 'negative'] },
        },
        required: ['word', 'score', 'sentiment'],
      },
    },
    summary: { type: 'STRING' },
  },
  required: ['sentiment', 'keywords', 'summary'],
};

function buildPrompt(name, reviews) {
  const reviewLines = reviews
    .map((r, i) => `${i + 1}. (별점 ${r.rating != null ? r.rating : '?'}) ${r.text || '(내용 없음)'}`)
    .join('\n');

  return (
    `다음은 "${name}"이라는 가게의 구글 리뷰 목록이다.\n\n${reviewLines}\n\n` +
    '위 리뷰들을 분석해서 아래 3가지를 정리해줘:\n' +
    '1. 각 리뷰를 긍정/보통/부정 중 하나로 분류하고, 전체 리뷰 중 각각 몇 개인지 개수를 세라 (positive/neutral/negative 합은 전체 리뷰 개수와 같아야 한다).\n' +
    '2. 리뷰에 실제로 등장한 표현을 기반으로 음식 이름, 맛, 분위기, 서비스 위주의 핵심 단어를 중복 없이 가능하면 8~15개 뽑아라. ' +
    '각 단어마다 리뷰에서 얼마나 중요하게/자주 언급되는지 1~10 점수를 매기고, 그 단어가 주로 좋은 맥락(positive)인지 나쁜 맥락(negative)인지 표시해라.\n' +
    '3. 이 가게에 대한 리뷰 전체 내용을 한국어 한 문장으로 요약해라.\n\n' +
    '반드시 지정된 JSON 스키마 형식으로만 응답해라.'
  );
}

module.exports = async (req, res) => {
  setCors(res);
  if (handlePreflight(req, res)) return;

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    console.error('[api/ai-analyze] GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다.');
    sendJson(res, 500, { error: '서버에 GEMINI_API_KEY가 설정되어 있지 않습니다.' });
    return;
  }

  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const reviews = Array.isArray(body.reviews) ? body.reviews.filter((r) => r && r.text) : [];

  if (!name || reviews.length === 0) {
    sendJson(res, 400, { error: 'name, reviews(1개 이상) 파라미터가 필요합니다.' });
    return;
  }

  try {
    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(name, reviews) }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });

    const bodyText = await geminiRes.text();
    if (!geminiRes.ok) {
      console.error('[api/ai-analyze] Gemini API 오류:', geminiRes.status, bodyText);
      sendJson(res, 502, { error: 'Gemini API 요청에 실패했습니다.', detail: bodyText });
      return;
    }

    const data = JSON.parse(bodyText);
    const text =
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;

    if (!text) {
      console.error('[api/ai-analyze] Gemini 응답에 결과 텍스트가 없습니다:', bodyText);
      sendJson(res, 502, { error: 'Gemini 응답을 해석하지 못했습니다.' });
      return;
    }

    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.keywords) && parsed.keywords.length > 15) {
      parsed.keywords = parsed.keywords.slice(0, 15);
    }

    sendJson(res, 200, parsed);
  } catch (err) {
    console.error('[api/ai-analyze] 요청 실패:', err.message);
    sendJson(res, 502, { error: 'AI 분석 요청에 실패했습니다.', detail: err.message });
  }
};
