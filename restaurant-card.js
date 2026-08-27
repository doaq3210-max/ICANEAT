/* restaurant-card.js — index.html / restaurants.html 공용
   카카오 검색 doc(또는 그와 동일한 필드를 가진 객체)을 받아 맛집 카드를 그리고,
   클릭 시 구글 리뷰 + AI 분석 모달을 띄우고, "담기" 버튼으로 saved_restaurants를 토글한다.
   window.icaneatAuth(auth.js)와 restaurant-card.css에 의존한다.

   사용법:
     var card = window.icaneatCard.renderCard(doc); grid.appendChild(card);
     window.icaneatCard.mount(grid); // grid 안의 카드에 담기/리뷰모달 이벤트를 위임 등록 (컨테이너당 1회만 실행됨)
*/
window.icaneatCard = (function () {
  'use strict';

  var REVIEWS_BASE = '/api/google-reviews';
  var PHOTO_BASE = '/api/google-photo';
  var AI_ANALYZE_BASE = '/api/ai-analyze';
  // v2: 응답에 photos 배열(구글 사진, 최대 3장)이 추가되며 캐시 스키마가 바뀜 —
  // 접두사를 올려서 이전 스키마(photo 단수)로 저장된 캐시를 자동으로 무시하고 새로 받아오게 한다.
  var REVIEW_CACHE_PREFIX = 'icaneat:reviews:v2:';
  var AI_CACHE_PREFIX = 'icaneat:ai:';
  var REVIEW_TEXT_TRUNCATE_LEN = 130;

  var mountedContainers = [];
  var authWired = false;
  var savedPlaceIds = new Set();

  var reviewModalOverlay = null;
  var reviewPanel = null;
  var reviewPanelBody = null;
  var activeReviewCard = null;

  // ---------- 카드 ----------

  function formatDistance(meters) {
    var n = parseInt(meters, 10);
    if (!n || isNaN(n) || n <= 0) return null;
    if (n < 1000) return n + 'm';
    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'km';
  }

  function renderCard(doc) {
    var card = document.createElement('article');
    card.className = 'rest-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', (doc.place_name || '이름 없음') + ' 리뷰 보기');
    card.dataset.placeId = doc.id || '';
    card.dataset.placeName = doc.place_name || '';
    card.dataset.category = doc.category_name || '';
    card.dataset.address = doc.road_address_name || doc.address_name || '';
    card.dataset.lat = doc.y || '';
    card.dataset.lng = doc.x || '';

    var body = document.createElement('div');
    body.className = 'rest-card-body';

    var top = document.createElement('div');
    top.className = 'rest-card-top';

    var name = document.createElement('h3');
    name.className = 'rest-card-name';
    name.textContent = doc.place_name || '이름 없음';
    top.appendChild(name);

    var topRight = document.createElement('div');
    topRight.className = 'rest-card-top-right';

    var distanceText = formatDistance(doc.distance);
    if (distanceText) {
      var distEl = document.createElement('span');
      distEl.className = 'rest-card-distance';
      distEl.textContent = distanceText;
      topRight.appendChild(distEl);
    }

    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'rest-card-save';
    saveBtn.textContent = '담기';
    saveBtn.setAttribute('aria-pressed', 'false');
    topRight.appendChild(saveBtn);

    top.appendChild(topRight);

    body.appendChild(top);

    if (doc.category_name) {
      var category = document.createElement('p');
      category.className = 'rest-card-category';
      category.textContent = doc.category_name;
      body.appendChild(category);
    }

    var address = document.createElement('p');
    address.className = 'rest-card-address';
    address.textContent = doc.road_address_name || doc.address_name || '주소 정보 없음';
    body.appendChild(address);

    if (doc.phone) {
      var phone = document.createElement('p');
      phone.className = 'rest-card-phone';
      phone.textContent = doc.phone;
      body.appendChild(phone);
    }

    card.appendChild(body);

    if (doc.place_url) {
      var link = document.createElement('a');
      link.className = 'rest-card-link';
      link.href = doc.place_url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = '카카오맵에서 보기 →';
      card.appendChild(link);
    }

    setSaveBtnState(saveBtn, savedPlaceIds.has(card.dataset.placeId));

    return card;
  }

  // ---------- 리뷰/AI 모달 ----------

  function ensureModal() {
    if (reviewModalOverlay) return;

    reviewModalOverlay = document.createElement('div');
    reviewModalOverlay.className = 'review-modal-overlay';
    reviewModalOverlay.id = 'reviewModalOverlay';

    reviewPanel = document.createElement('div');
    reviewPanel.className = 'review-panel';
    reviewPanel.id = 'reviewPanel';

    reviewPanelBody = document.createElement('div');
    reviewPanelBody.className = 'review-panel-body';
    reviewPanelBody.id = 'reviewPanelBody';

    reviewPanel.appendChild(reviewPanelBody);
    reviewModalOverlay.appendChild(reviewPanel);
    document.body.appendChild(reviewModalOverlay);

    reviewModalOverlay.addEventListener('click', function (e) {
      if (e.target === reviewModalOverlay) closePanel();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isPanelOpen()) closePanel();
    });

    reviewPanel.addEventListener('click', function (e) {
      if (e.target.closest('.review-panel-close')) closePanel();
    });
  }

  function isPanelOpen() {
    return reviewModalOverlay.classList.contains('open');
  }

  function openPanel() {
    reviewModalOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closePanel() {
    if (!reviewModalOverlay) return;
    reviewModalOverlay.classList.remove('open');
    document.body.style.overflow = '';
    if (activeReviewCard) {
      activeReviewCard.classList.remove('is-active-review');
      activeReviewCard = null;
    }
  }

  function buildCacheKey(card, prefix) {
    var id = card.dataset.placeId;
    if (id) return prefix + 'id:' + id;
    var lat = parseFloat(card.dataset.lat);
    var lng = parseFloat(card.dataset.lng);
    return prefix + encodeURIComponent(card.dataset.placeName) + ':' +
      lat.toFixed(4) + ',' + lng.toFixed(4);
  }

  function reviewCacheKey(card) {
    return buildCacheKey(card, REVIEW_CACHE_PREFIX);
  }

  function aiCacheKey(card) {
    return buildCacheKey(card, AI_CACHE_PREFIX);
  }

  function getCachedReview(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setCachedReview(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      // 저장 공간 부족, 프라이빗 모드 등 — 캐시 없이 조용히 진행.
    }
  }

  function buildPanelHeader(name) {
    var header = document.createElement('div');
    header.className = 'review-panel-header';

    var h3 = document.createElement('h3');
    h3.className = 'review-panel-name';
    h3.textContent = name || '';
    header.appendChild(h3);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'review-panel-close';
    closeBtn.setAttribute('aria-label', '리뷰 패널 닫기');
    closeBtn.textContent = '×';
    header.appendChild(closeBtn);

    return header;
  }

  function renderPanelLoading(name) {
    reviewPanelBody.innerHTML = '';
    reviewPanelBody.appendChild(buildPanelHeader(name));
    var status = document.createElement('p');
    status.className = 'review-panel-status';
    status.textContent = '리뷰를 불러오는 중…';
    reviewPanelBody.appendChild(status);
  }

  function renderPanelNotFound(name) {
    reviewPanelBody.innerHTML = '';
    reviewPanelBody.appendChild(buildPanelHeader(name));
    var status = document.createElement('p');
    status.className = 'review-panel-status';
    status.textContent = '리뷰를 찾을 수 없어요.';
    reviewPanelBody.appendChild(status);
  }

  function renderPanelError(name) {
    reviewPanelBody.innerHTML = '';
    reviewPanelBody.appendChild(buildPanelHeader(name));
    var status = document.createElement('p');
    status.className = 'review-panel-status review-panel-status--error';
    status.textContent = '리뷰를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
    reviewPanelBody.appendChild(status);
  }

  function renderPanelResult(card, data) {
    reviewPanelBody.innerHTML = '';
    reviewPanelBody.appendChild(buildPanelHeader(data.name));

    var ratingP = document.createElement('p');
    ratingP.className = 'review-panel-rating';
    ratingP.textContent = (data.rating != null)
      ? '⭐ ' + data.rating.toFixed(1) + ' (' + new Intl.NumberFormat('ko-KR').format(data.userRatingCount || 0) + '개 리뷰)'
      : '평점 정보 없음';
    reviewPanelBody.appendChild(ratingP);

    var photos = data.photos || [];
    if (photos.length > 0) {
      Promise.all(photos.map(function (p) { return fetchPhotoUri(p.name, 640); }))
        .then(function (uris) {
          if (activeReviewCard !== card) return;
          var valid = uris.filter(Boolean);
          if (valid.length === 0) return;
          reviewPanelBody.insertBefore(buildPhotoCarousel(valid), ratingP.nextSibling);
        });
    }

    var list = document.createElement('ul');
    list.className = 'review-list';

    (data.reviews || []).forEach(function (r) {
      var li = document.createElement('li');
      li.className = 'review-item';

      var meta = document.createElement('div');
      meta.className = 'review-item-meta';

      var author = document.createElement('span');
      author.className = 'review-item-author';
      author.textContent = r.author || '익명';
      meta.appendChild(author);

      var ratingSpan = document.createElement('span');
      ratingSpan.textContent = '★'.repeat(Math.round(r.rating || 0));
      meta.appendChild(ratingSpan);

      var timeSpan = document.createElement('span');
      timeSpan.textContent = r.relativeTime || '';
      meta.appendChild(timeSpan);

      li.appendChild(meta);

      var text = document.createElement('p');
      text.className = 'review-item-text';
      var fullText = r.text || '';
      li.appendChild(text);

      if (fullText.length > REVIEW_TEXT_TRUNCATE_LEN) {
        var truncated = fullText.slice(0, REVIEW_TEXT_TRUNCATE_LEN) + '…';
        text.textContent = truncated;

        var toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'review-text-toggle';
        toggle.textContent = '더보기';
        var expanded = false;
        toggle.addEventListener('click', function () {
          expanded = !expanded;
          text.textContent = expanded ? fullText : truncated;
          toggle.textContent = expanded ? '접기' : '더보기';
        });
        li.appendChild(toggle);
      } else {
        text.textContent = fullText;
      }

      list.appendChild(li);
    });

    reviewPanelBody.appendChild(list);

    if ((data.reviews || []).length > 0) {
      var aiRefs = buildAiSection();
      reviewPanelBody.appendChild(aiRefs.section);
      renderAiLoading(aiRefs);
      runAiAnalysis(card, data, aiRefs);
    }

    if (data.mapsUri) {
      var link = document.createElement('a');
      link.className = 'review-panel-link';
      link.href = data.mapsUri;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = '구글 지도에서 전체 리뷰 보기 →';
      reviewPanelBody.appendChild(link);
    }
  }

  function buildAiSection() {
    var section = document.createElement('div');
    section.className = 'ai-section';

    var title = document.createElement('p');
    title.className = 'ai-section-title';
    title.textContent = 'AI 리뷰 분석';
    section.appendChild(title);

    var body = document.createElement('div');
    body.className = 'ai-section-body';
    section.appendChild(body);

    return { section: section, body: body };
  }

  function renderAiLoading(refs) {
    refs.body.innerHTML = '';
    var status = document.createElement('p');
    status.className = 'review-panel-status';
    status.textContent = 'AI가 분석하는 중…';
    refs.body.appendChild(status);
  }

  function renderAiError(refs) {
    refs.body.innerHTML = '';
    var status = document.createElement('p');
    status.className = 'review-panel-status review-panel-status--error';
    status.textContent = 'AI 분석을 불러오지 못했어요.';
    refs.body.appendChild(status);
  }

  function renderAiResult(refs, result) {
    refs.body.innerHTML = '';

    var sentiment = result.sentiment || {};
    var pos = sentiment.positive || 0;
    var neu = sentiment.neutral || 0;
    var neg = sentiment.negative || 0;
    var total = pos + neu + neg || 1;

    var bar = document.createElement('div');
    bar.className = 'sentiment-bar';
    [
      ['positive', pos],
      ['neutral', neu],
      ['negative', neg],
    ].forEach(function (entry) {
      if (entry[1] <= 0) return;
      var seg = document.createElement('div');
      seg.className = 'sentiment-bar-seg ' + entry[0];
      seg.style.flexBasis = (entry[1] / total * 100) + '%';
      bar.appendChild(seg);
    });
    refs.body.appendChild(bar);

    var legend = document.createElement('div');
    legend.className = 'sentiment-legend';
    [
      ['positive', '긍정', pos],
      ['neutral', '보통', neu],
      ['negative', '부정', neg],
    ].forEach(function (entry) {
      var item = document.createElement('span');
      var dot = document.createElement('span');
      dot.className = 'sentiment-legend-dot ' + entry[0];
      item.appendChild(dot);
      item.appendChild(document.createTextNode(entry[1] + ' ' + entry[2]));
      legend.appendChild(item);
    });
    refs.body.appendChild(legend);

    var keywords = Array.isArray(result.keywords) ? result.keywords : [];
    if (keywords.length > 0) {
      var wcWrap = document.createElement('div');
      wcWrap.className = 'wordcloud-wrap';
      var canvas = document.createElement('canvas');
      canvas.className = 'wordcloud-canvas';
      wcWrap.appendChild(canvas);
      refs.body.appendChild(wcWrap);

      canvas.width = reviewPanelBody.clientWidth || 320;
      canvas.height = 220;

      if (window.WordCloud) {
        window.WordCloud(canvas, {
          list: keywords.map(function (k) { return [k.word, k.score || 1]; }),
          weightFactor: function (size) { return size * 5 + 14; },
          fontFamily: "'Pretendard Variable','Pretendard',sans-serif",
          backgroundColor: 'transparent',
          color: function (word) {
            var kw = keywords.filter(function (k) { return k.word === word; })[0];
            return kw && kw.sentiment === 'negative' ? '#C6544B' : '#4C9A6A';
          },
        });
      }
    }

    if (result.summary) {
      var bubble = document.createElement('div');
      bubble.className = 'ai-summary-bubble';
      var label = document.createElement('span');
      label.className = 'ai-summary-label';
      label.textContent = 'AI 총평';
      bubble.appendChild(label);
      bubble.appendChild(document.createTextNode(result.summary));
      refs.body.appendChild(bubble);
    }
  }

  function runAiAnalysis(card, data, refs) {
    var key = aiCacheKey(card);
    var cached = getCachedReview(key);
    if (cached) {
      renderAiResult(refs, cached);
      return;
    }

    fetch(AI_ANALYZE_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: card.dataset.placeName,
        reviews: data.reviews.map(function (r) { return { text: r.text, rating: r.rating }; }),
      }),
    })
      .then(function (res) { return res.json(); })
      .then(function (result) {
        if (activeReviewCard !== card) return;
        if (result.error) throw new Error(result.error);
        setCachedReview(key, result);
        renderAiResult(refs, result);
      })
      .catch(function () {
        if (activeReviewCard === card) renderAiError(refs);
      });
  }

  function openReviewForCard(card) {
    if (activeReviewCard === card && isPanelOpen()) {
      closePanel();
      return;
    }

    if (activeReviewCard) {
      activeReviewCard.classList.remove('is-active-review');
    }
    activeReviewCard = card;
    card.classList.add('is-active-review');
    openPanel();

    var key = reviewCacheKey(card);
    var cached = getCachedReview(key);
    if (cached) {
      if (cached.found) {
        renderPanelResult(card, cached);
      } else {
        renderPanelNotFound(card.dataset.placeName);
      }
      return;
    }

    renderPanelLoading(card.dataset.placeName);

    var params = new URLSearchParams();
    params.set('name', card.dataset.placeName);
    params.set('lat', card.dataset.lat);
    params.set('lng', card.dataset.lng);

    fetch(REVIEWS_BASE + '?' + params.toString())
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (activeReviewCard !== card) return;
        if (data.error) throw new Error(data.error);
        setCachedReview(key, data);
        if (data.found) {
          renderPanelResult(card, data);
        } else {
          renderPanelNotFound(card.dataset.placeName);
        }
      })
      .catch(function () {
        if (activeReviewCard === card) renderPanelError(card.dataset.placeName);
      });
  }

  // ---------- 담기 ----------

  function setSaveBtnState(saveBtn, isSaved) {
    saveBtn.classList.toggle('is-saved', isSaved);
    saveBtn.textContent = isSaved ? '담았어요' : '담기';
    saveBtn.setAttribute('aria-pressed', isSaved ? 'true' : 'false');
  }

  function applySavedStateToAllCards() {
    mountedContainers.forEach(function (container) {
      Array.prototype.forEach.call(container.querySelectorAll('.rest-card'), function (card) {
        var btn = card.querySelector('.rest-card-save');
        if (btn) setSaveBtnState(btn, savedPlaceIds.has(card.dataset.placeId));
      });
    });
  }

  function loadSavedPlaceIds() {
    window.icaneatAuth.getClient()
      .from('saved_restaurants')
      .select('place_id')
      .then(function (res) {
        if (res.error) {
          console.error('[담기] 저장 목록 조회 실패:', res.error.message);
          return;
        }
        savedPlaceIds = new Set((res.data || []).map(function (row) { return row.place_id; }));
        applySavedStateToAllCards();
      });
  }

  function wireAuth() {
    if (authWired) return;
    authWired = true;
    window.icaneatAuth.onChange(function (user) {
      if (user) {
        loadSavedPlaceIds();
      } else {
        savedPlaceIds.clear();
        applySavedStateToAllCards();
      }
    });
  }

  function toggleSave(saveBtn, card) {
    if (!window.icaneatAuth.getUser()) {
      alert('로그인이 필요합니다.');
      window.icaneatAuth.requireLogin();
      return;
    }

    var placeId = card.dataset.placeId;
    if (!placeId || saveBtn.disabled) return;

    var isSaved = savedPlaceIds.has(placeId);
    saveBtn.disabled = true;

    var supa = window.icaneatAuth.getClient();
    var request = isSaved
      ? supa.from('saved_restaurants').delete().eq('place_id', placeId)
      : supa.from('saved_restaurants').insert({
          place_id: placeId,
          place_name: card.dataset.placeName || '',
          category_name: card.dataset.category || null,
          address: card.dataset.address || null,
          lat: card.dataset.lat ? parseFloat(card.dataset.lat) : null,
          lng: card.dataset.lng ? parseFloat(card.dataset.lng) : null,
        });

    request.then(function (res) {
      saveBtn.disabled = false;

      if (res.error) {
        if (!isSaved && res.error.code === '23505') {
          // 동시 클릭 등으로 이미 담겨있던 경우 — 담김 상태로 동기화.
          savedPlaceIds.add(placeId);
          setSaveBtnState(saveBtn, true);
          return;
        }
        console.error('[담기] 실패:', res.error.message);
        alert('처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.');
        return;
      }

      if (isSaved) {
        savedPlaceIds.delete(placeId);
      } else {
        savedPlaceIds.add(placeId);
      }
      setSaveBtnState(saveBtn, !isSaved);

      if (window.gtag) {
        window.gtag('event', isSaved ? 'remove_from_wishlist' : 'add_to_wishlist', {
          place_id: placeId,
          place_name: card.dataset.placeName,
        });
      }
    });
  }

  // ---------- mount ----------

  function mount(container) {
    ensureModal();
    wireAuth();

    if (container.__icaneatCardMounted) return;
    container.__icaneatCardMounted = true;
    mountedContainers.push(container);

    // "담기" 버튼: 카드가 검색/렌더로 계속 새로 추가되므로 컨테이너에 이벤트 위임.
    container.addEventListener('click', function (e) {
      var saveBtn = e.target.closest('.rest-card-save');
      if (!saveBtn) return;

      e.preventDefault();
      e.stopPropagation();

      var card = saveBtn.closest('.rest-card');
      if (window.gtag) {
        window.gtag('event', 'save_button_click', {
          place_id: card.dataset.placeId,
          place_name: card.dataset.placeName,
        });
      }
      toggleSave(saveBtn, card);
    });

    // 카드 클릭: 구글 리뷰 패널을 열고 채운다. "담기"/카카오맵 링크 클릭은
    // 각자의 동작(토글/이동)이 있으므로 여기서는 무시한다.
    container.addEventListener('click', function (e) {
      if (e.target.closest('.rest-card-save')) return;
      if (e.target.closest('.rest-card-link')) return;

      var card = e.target.closest('.rest-card');
      if (!card) return;

      openReviewForCard(card);
    });

    // 카드 자체가 포커스 대상일 때만 반응 — 안의 "담기" 버튼/카카오맵 링크는
    // 자기 자신의 키보드 동작을 그대로 쓴다.
    container.addEventListener('keydown', function (e) {
      if (e.target.closest('.rest-card-save')) return;
      if (e.target.closest('.rest-card-link')) return;

      var card = e.target.closest('.rest-card');
      if (!card || e.target !== card) return;

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openReviewForCard(card);
      }
    });

    applySavedStateToAllCards();
  }

  // ---------- 인기 랭킹 카드 썸네일 (구글 사진, index.html 전용 사용) ----------
  // 리뷰와 같은 캐시(REVIEW_CACHE_PREFIX)를 공유해 리뷰 패널을 나중에 열어도
  // 별도 API 호출 없이 같은 데이터를 재사용한다.

  function fetchPhotoUri(photoName, maxWidthPx) {
    var params = new URLSearchParams();
    params.set('name', photoName);
    params.set('maxWidthPx', String(maxWidthPx || 480));
    return fetch(PHOTO_BASE + '?' + params.toString())
      .then(function (res) { return res.json(); })
      .then(function (res) { return res.photoUri || null; })
      .catch(function () { return null; });
  }

  function applyThumbnailPhoto(photos, imgEl, wrapEl) {
    var first = Array.isArray(photos) && photos.length > 0 ? photos[0] : null;
    if (!first || !first.name) return;
    fetchPhotoUri(first.name, 480).then(function (photoUri) {
      if (!photoUri) return;
      imgEl.src = photoUri;
      wrapEl.hidden = false;
    });
  }

  function loadThumbnail(card, imgEl, wrapEl) {
    var key = reviewCacheKey(card);
    var cached = getCachedReview(key);
    if (cached) {
      if (cached.found) applyThumbnailPhoto(cached.photos, imgEl, wrapEl);
      return;
    }

    var params = new URLSearchParams();
    params.set('name', card.dataset.placeName);
    params.set('lat', card.dataset.lat);
    params.set('lng', card.dataset.lng);

    fetch(REVIEWS_BASE + '?' + params.toString())
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        setCachedReview(key, data);
        if (data.found) applyThumbnailPhoto(data.photos, imgEl, wrapEl);
      })
      .catch(function () {});
  }

  // ---------- 리뷰 모달 사진 캐러셀 (최대 3장, 화살표/스와이프 네비게이션) ----------

  function buildPhotoCarousel(photoUris) {
    var wrap = document.createElement('div');
    wrap.className = 'review-panel-photos';

    var track = document.createElement('div');
    track.className = 'review-panel-photos-track';
    photoUris.forEach(function (uri) {
      var img = document.createElement('img');
      img.src = uri;
      img.alt = '';
      track.appendChild(img);
    });
    wrap.appendChild(track);

    var index = 0;
    var counter = null;

    function update() {
      track.style.transform = 'translateX(-' + index * 100 + '%)';
      if (counter) counter.textContent = (index + 1) + '/' + photoUris.length;
    }

    function goTo(newIndex) {
      index = (newIndex + photoUris.length) % photoUris.length;
      update();
    }

    if (photoUris.length > 1) {
      var prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'review-panel-photos-arrow review-panel-photos-arrow--prev';
      prevBtn.setAttribute('aria-label', '이전 사진');
      prevBtn.textContent = '‹';
      prevBtn.addEventListener('click', function () { goTo(index - 1); });

      var nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'review-panel-photos-arrow review-panel-photos-arrow--next';
      nextBtn.setAttribute('aria-label', '다음 사진');
      nextBtn.textContent = '›';
      nextBtn.addEventListener('click', function () { goTo(index + 1); });

      wrap.appendChild(prevBtn);
      wrap.appendChild(nextBtn);

      counter = document.createElement('span');
      counter.className = 'review-panel-photos-counter';
      wrap.appendChild(counter);

      var touchStartX = null;
      wrap.addEventListener('touchstart', function (e) {
        touchStartX = e.touches[0].clientX;
      }, { passive: true });
      wrap.addEventListener('touchend', function (e) {
        if (touchStartX == null) return;
        var dx = e.changedTouches[0].clientX - touchStartX;
        touchStartX = null;
        if (Math.abs(dx) < 40) return;
        goTo(dx < 0 ? index + 1 : index - 1);
      }, { passive: true });
    }

    update();
    return wrap;
  }

  return {
    renderCard: renderCard,
    formatDistance: formatDistance,
    mount: mount,
    closePanel: closePanel,
    loadThumbnail: loadThumbnail,
  };
})();
