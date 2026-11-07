import { searchHotels, usingDemo } from './api.js';
import { CITIES } from './demo-provider.js';
import { googleHotelsUrl, nights } from './sites.js';

const $ = (sel) => document.querySelector(sel);
const fmt = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 });
const won = (v) => fmt.format(v);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 저장 불가(사파리 개인정보 보호 모드 등) — 무시 */
    }
  },
};

const state = {
  params: null,
  result: null,
  favorites: store.get('favorites', []),
  recent: store.get('recent', []),
  priceBounds: [0, 0],
};

// ---------- 날짜 기본값 ----------
function isoDate(d) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

function initForm() {
  const today = isoDate(new Date());
  const ci = $('#checkIn');
  const co = $('#checkOut');
  ci.min = today;
  ci.value = addDays(today, 7);
  co.min = addDays(ci.value, 1);
  co.value = addDays(ci.value, 2);
  ci.addEventListener('change', () => {
    co.min = addDays(ci.value, 1);
    if (co.value <= ci.value) co.value = addDays(ci.value, 1);
  });

  $('#cityList').innerHTML = CITIES.map((c) => `<option value="${esc(c.name)}">${esc(c.en)}</option>`).join('');

  // 공유 링크(URL 파라미터)로 진입한 경우 바로 검색
  const u = new URLSearchParams(location.search);
  if (u.get('d')) {
    $('#destination').value = u.get('d');
    if (u.get('in') && u.get('in') >= today) ci.value = u.get('in');
    if (u.get('out') && u.get('out') > ci.value) co.value = u.get('out');
    if (u.get('a')) $('#adults').value = u.get('a');
    if (u.get('r')) $('#rooms').value = u.get('r');
    runSearch();
  }
}

function readForm() {
  return {
    destination: $('#destination').value.trim(),
    checkIn: $('#checkIn').value,
    checkOut: $('#checkOut').value,
    adults: Number($('#adults').value),
    rooms: Number($('#rooms').value),
  };
}

// ---------- 검색 ----------
async function runSearch() {
  const params = readForm();
  if (!params.destination) return;
  if (params.checkOut <= params.checkIn) {
    toast('체크아웃은 체크인 다음 날 이후여야 해요.');
    return;
  }
  state.params = params;
  switchTab('results');
  saveRecent(params);
  history.replaceState(null, '', `?${new URLSearchParams({ d: params.destination, in: params.checkIn, out: params.checkOut, a: params.adults, r: params.rooms })}`);

  const btn = $('#searchForm button[type=submit]');
  btn.disabled = true;
  btn.textContent = '가격 비교 중…';
  $('#toolbar').hidden = true;
  $('#results').innerHTML = '<div class="skeleton"></div>'.repeat(4);

  try {
    const result = await searchHotels(params);
    state.result = result;
    if (!result.hotels.length) {
      $('#results').innerHTML = `
        <div class="empty">
          <p class="empty-title">'${esc(params.destination)}' 검색 결과가 없어요</p>
          <p>${usingDemo ? `데모 모드에서는 다음 도시를 검색할 수 있어요:<br>${CITIES.map((c) => esc(c.name)).join(', ')}` : '다른 목적지나 날짜로 검색해 보세요.'}</p>
        </div>`;
      return;
    }
    const totals = result.hotels.map((h) => h.best.total);
    state.priceBounds = [Math.min(...totals), Math.max(...totals)];
    $('#maxPrice').value = 100;
    $('#toolbar').hidden = false;
    renderResults();
  } catch (err) {
    $('#results').innerHTML = `
      <div class="empty">
        <p class="empty-title">검색에 실패했어요</p>
        <p>${navigator.onLine ? esc(err.message) : '오프라인 상태예요. 인터넷 연결을 확인해 주세요.'}</p>
      </div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '최저가 검색';
  }
}

function maxPriceValue() {
  const [lo, hi] = state.priceBounds;
  return lo + ((hi - lo) * Number($('#maxPrice').value)) / 100;
}

function renderResults() {
  const { result, params } = state;
  if (!result) return;
  const sortBy = $('#sortBy').value;
  const minStars = Number($('#starFilter').value);
  const maxP = maxPriceValue();
  const freeCancel = $('#freeCancel').checked;
  $('#maxPriceOut').textContent = won(Math.ceil(maxP / 1000) * 1000);

  let list = result.hotels.filter(
    (h) => h.stars >= minStars && h.best.total <= maxP + 1 && (!freeCancel || h.freeCancelAvailable),
  );
  if (freeCancel) {
    // 무료취소 조건이면 무료취소 오퍼 중 최저가를 대표 가격으로
    list = list.map((h) => {
      const offers = h.offers.filter((o) => o.freeCancel);
      return { ...h, best: offers[0], offers };
    });
  }
  const sorters = {
    price: (a, b) => a.best.total - b.best.total,
    rating: (a, b) => b.rating - a.rating || a.best.total - b.best.total,
    stars: (a, b) => b.stars - a.stars || a.best.total - b.best.total,
    savings: (a, b) => b.savings - a.savings,
  };
  list.sort(sorters[sortBy]);

  const n = nights(params.checkIn, params.checkOut);
  const cheapest = list[0] && sortBy === 'price' ? list[0] : null;
  $('#summary').innerHTML =
    `<strong>${esc(result.city || params.destination)}</strong> · ${params.checkIn.slice(5).replace('-', '/')}~${params.checkOut.slice(5).replace('-', '/')} (${n}박) · 성인 ${params.adults} · 객실 ${params.rooms}<br>` +
    `호텔 <strong>${list.length}</strong>곳` +
    (list.length ? ` · 최저 <strong>${won(Math.min(...list.map((h) => h.best.total)))}</strong>` : '');

  const container = $('#results');
  container.innerHTML = '';
  if (!list.length) {
    container.innerHTML = '<div class="empty"><p class="empty-title">조건에 맞는 호텔이 없어요</p><p>필터를 조정해 보세요.</p></div>';
    return;
  }
  const frag = document.createDocumentFragment();
  list.forEach((h) => frag.appendChild(hotelCard(h, params, h === cheapest)));
  container.appendChild(frag);
}

function hotelCard(h, params, isCheapest) {
  const el = $('#hotelCardTpl').content.firstElementChild.cloneNode(true);
  const n = nights(params.checkIn, params.checkOut);
  const thumb = el.querySelector('.hotel-thumb');
  thumb.style.background = h.color || 'var(--accent)';
  el.querySelector('.thumb-initial').textContent = h.name.trim().charAt(0);
  el.querySelector('.hotel-name').textContent = h.name;
  el.querySelector('.hotel-meta').innerHTML =
    `<span class="stars">${'★'.repeat(h.stars)}</span> · <span class="score">${h.rating.toFixed(1)}</span> 리뷰 ${h.reviews.toLocaleString('ko-KR')}개<br>` +
    `${esc(h.area)}${h.distance != null ? ` · 중심지 ${h.distance}km` : ''}`;

  const tags = [];
  if (isCheapest) tags.push('<span class="tag good">이 지역 최저가</span>');
  if (h.offers.some((o) => o.freeCancel)) tags.push('<span class="tag good">무료 취소 가능</span>');
  if (h.offers.some((o) => o.breakfast)) tags.push('<span class="tag">조식 포함 옵션</span>');
  (h.amenities || []).slice(0, 3).forEach((a) => tags.push(`<span class="tag">${esc(a)}</span>`));
  el.querySelector('.hotel-tags').innerHTML = tags.join('');

  el.querySelector('.lowest-site').textContent = h.best.siteName;
  el.querySelector('.lowest-price').textContent = won(h.best.total);
  el.querySelector('.per-night').textContent = `1박 ${won(h.best.perNight)}${params.rooms > 1 ? ` × ${params.rooms}실` : ''} · ${n}박 총액`;
  el.querySelector('.savings').textContent =
    h.offers.length > 1 && h.savings > 0 ? `${h.offers.length}개 사이트 비교 · 최대 ${won(h.savings)} 절약` : `${h.offers.length}개 사이트`;

  const favBtn = el.querySelector('.fav');
  const setFav = () => {
    const on = isFavorite(h.id);
    favBtn.textContent = on ? '♥' : '♡';
    favBtn.setAttribute('aria-pressed', String(on));
    favBtn.setAttribute('aria-label', on ? '찜 해제' : '찜하기');
  };
  setFav();
  favBtn.addEventListener('click', () => {
    toggleFavorite(h, params);
    setFav();
  });
  el.querySelector('.btn-compare').addEventListener('click', () => openDetail(h, params));
  return el;
}

// ---------- 가격 비교 상세 ----------
function openDetail(h, params) {
  const n = nights(params.checkIn, params.checkOut);
  const best = h.offers[0].total;
  $('#detailBody').innerHTML = `
    <div class="detail-head">
      <h2>${esc(h.name)}</h2>
      <p>${'★'.repeat(h.stars)} · 평점 ${h.rating.toFixed(1)} · ${esc(h.area)}</p>
      <p>${params.checkIn} ~ ${params.checkOut} · ${n}박 · 성인 ${params.adults} · 객실 ${params.rooms}</p>
      <button class="detail-close" aria-label="닫기">✕</button>
    </div>
    <ul class="offers">
      ${h.offers
        .map(
          (o, i) => `
        <li class="offer">
          <div>
            <span class="offer-site">${esc(o.siteName)}</span>${i === 0 ? '<span class="offer-best">최저가</span>' : ''}
            <div class="offer-note">${[o.freeCancel ? '무료 취소' : '환불 불가', o.breakfast ? '조식 포함' : '조식 불포함'].join(' · ')} · 1박 ${won(o.perNight)}</div>
          </div>
          <div class="offer-price ${i === 0 ? 'best' : ''}">${won(o.total)}${i > 0 ? `<div class="offer-note">+${won(o.total - best)}</div>` : ''}</div>
          <a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.siteName)}에서 보기 →</a>
        </li>`,
        )
        .join('')}
    </ul>
    <div class="detail-foot">
      ${usingDemo ? '※ 데모 모드: 표시된 호텔과 가격은 가상 데이터입니다. 링크를 누르면 실제 사이트에서 같은 조건으로 검색합니다.<br>' : ''}
      <a href="${esc(googleHotelsUrl(h.searchName || h.name, params))}" target="_blank" rel="noopener">Google 호텔에서도 비교하기 →</a>
    </div>`;
  const dlg = $('#detail');
  dlg.querySelector('.detail-close').addEventListener('click', () => dlg.close());
  dlg.showModal();
}

$('#detail').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.close();
});

// ---------- 찜 ----------
function isFavorite(id) {
  return state.favorites.some((f) => f.hotel.id === id);
}
function toggleFavorite(h, params) {
  if (isFavorite(h.id)) {
    state.favorites = state.favorites.filter((f) => f.hotel.id !== h.id);
    toast('찜 목록에서 뺐어요');
  } else {
    state.favorites.unshift({ hotel: h, params, savedAt: Date.now() });
    toast('찜 목록에 담았어요');
  }
  store.set('favorites', state.favorites);
  renderFavCount();
}
function renderFavCount() {
  $('#favCount').textContent = state.favorites.length ? state.favorites.length : '';
}
function renderFavorites() {
  const c = $('#favorites');
  c.innerHTML = '';
  if (!state.favorites.length) {
    c.innerHTML = '<div class="empty"><p class="empty-title">찜한 호텔이 없어요</p><p>검색 결과에서 ♡ 를 눌러 담아 두세요. 오프라인에서도 볼 수 있어요.</p></div>';
    return;
  }
  state.favorites.forEach(({ hotel, params }) => {
    const card = hotelCard(hotel, params, false);
    card.querySelector('.lowest-label').textContent = `${params.checkIn.slice(5).replace('-', '/')} 기준 최저가`;
    card.querySelector('.fav').addEventListener('click', () => renderFavorites());
    c.appendChild(card);
  });
}

// ---------- 최근 검색 ----------
function saveRecent(p) {
  const key = `${p.destination}|${p.checkIn}|${p.checkOut}`;
  state.recent = [p, ...state.recent.filter((r) => `${r.destination}|${r.checkIn}|${r.checkOut}` !== key)].slice(0, 6);
  store.set('recent', state.recent);
  renderRecent();
}
function renderRecent() {
  const today = isoDate(new Date());
  const list = state.recent.filter((r) => r.checkIn >= today);
  $('#recent').hidden = !list.length;
  const c = $('#recentList');
  c.innerHTML = '';
  list.forEach((r) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${r.destination} ${r.checkIn.slice(5).replace('-', '/')}~${r.checkOut.slice(5).replace('-', '/')}`;
    b.addEventListener('click', () => {
      $('#destination').value = r.destination;
      $('#checkIn').value = r.checkIn;
      $('#checkOut').min = addDays(r.checkIn, 1);
      $('#checkOut').value = r.checkOut;
      $('#adults').value = r.adults;
      $('#rooms').value = r.rooms;
      runSearch();
    });
    c.appendChild(b);
  });
}

// ---------- 탭 ----------
function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) => {
    const on = t.dataset.tab === name;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
  });
  $('#resultsPanel').hidden = name !== 'results';
  $('#favoritesPanel').hidden = name !== 'favorites';
  if (name === 'favorites') renderFavorites();
  if (name === 'results') renderResults();
}

// ---------- 기타 UI ----------
let toastTimer;
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2000);
}

function updateOnline() {
  $('#offlineBadge').hidden = navigator.onLine;
}

// ---------- PWA ----------
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $('#installBtn').hidden = false;
});
$('#installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $('#installBtn').hidden = true;
});
window.addEventListener('appinstalled', () => ($('#installBtn').hidden = true));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// ---------- 이벤트 연결 ----------
$('#searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  runSearch();
});
['#sortBy', '#starFilter', '#freeCancel'].forEach((s) => $(s).addEventListener('change', renderResults));
$('#maxPrice').addEventListener('input', renderResults);
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);

$('#demoBanner').hidden = !usingDemo;
$('#providerNote').textContent = usingDemo
  ? '데모 모드 — 호텔과 가격은 가상 데이터이며, 각 사이트 링크는 실제 사이트에서 같은 조건으로 검색합니다. 실제 가격을 연동하려면 js/config.js 의 API_ENDPOINT 를 설정하세요.'
  : '가격은 예약 사이트 사정에 따라 실시간으로 달라질 수 있습니다.';

initForm();
renderRecent();
renderFavCount();
updateOnline();
