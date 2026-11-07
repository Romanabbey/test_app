// 데모 데이터 제공자
// 실제 API 없이도 앱의 흐름(검색 → 가격 비교 → 최저가 정렬)을 체험할 수 있도록
// 도시·날짜·인원에 따라 결정적으로(같은 조건이면 같은 결과) 가상 호텔과 가격을 생성합니다.
// 호텔 이름과 가격은 모두 가상의 값입니다.

import { SITES, nights } from './sites.js';

export const CITIES = [
  { name: '서울', en: 'Seoul', base: 140000, areas: ['명동', '강남', '홍대', '종로', '여의도', '잠실', '이태원', '동대문'] },
  { name: '부산', en: 'Busan', base: 120000, areas: ['해운대', '광안리', '서면', '남포동', '기장', '송정'] },
  { name: '제주', en: 'Jeju', base: 130000, areas: ['제주시', '애월', '서귀포', '중문', '함덕', '성산'] },
  { name: '강릉', en: 'Gangneung', base: 110000, areas: ['경포', '안목', '주문진', '강문'] },
  { name: '경주', en: 'Gyeongju', base: 95000, areas: ['보문', '황리단길', '불국사', '시내'] },
  { name: '여수', en: 'Yeosu', base: 105000, areas: ['돌산', '여수엑스포', '종포', '웅천'] },
  { name: '도쿄', en: 'Tokyo', base: 190000, areas: ['신주쿠', '시부야', '긴자', '우에노', '아사쿠사', '이케부쿠로'] },
  { name: '오사카', en: 'Osaka', base: 150000, areas: ['난바', '우메다', '신사이바시', '텐노지', '혼마치'] },
  { name: '후쿠오카', en: 'Fukuoka', base: 120000, areas: ['하카타', '텐진', '나카스', '모모치'] },
  { name: '방콕', en: 'Bangkok', base: 90000, areas: ['수쿰빗', '실롬', '시암', '카오산', '리버사이드'] },
  { name: '다낭', en: 'Da Nang', base: 85000, areas: ['미케비치', '한시장', '논느억', '선짜'] },
  { name: '싱가포르', en: 'Singapore', base: 260000, areas: ['마리나베이', '오차드', '클라키', '센토사', '부기스'] },
  { name: '타이베이', en: 'Taipei', base: 130000, areas: ['시먼딩', '신이', '중산', '타이베이역'] },
  { name: '홍콩', en: 'Hong Kong', base: 210000, areas: ['침사추이', '센트럴', '코즈웨이베이', '몽콕'] },
  { name: '파리', en: 'Paris', base: 280000, areas: ['마레', '생제르맹', '몽마르트르', '오페라', '라탱'] },
  { name: '런던', en: 'London', base: 300000, areas: ['소호', '코벤트가든', '켄싱턴', '쇼디치', '패딩턴'] },
  { name: '뉴욕', en: 'New York', base: 350000, areas: ['미드타운', '타임스퀘어', '소호', '첼시', '브루클린'] },
  { name: '하와이', en: 'Honolulu', base: 320000, areas: ['와이키키', '알라모아나', '코올리나', '카할라'] },
];

const STYLES = [
  ['그랜드', 5], ['팰리스', 5], ['리저브', 5], ['스위트', 4], ['플라자', 4], ['헤리티지', 4],
  ['오션뷰', 4], ['가든', 3], ['스테이', 3], ['부티크', 3], ['인', 2], ['레지던스', 3],
  ['시티', 3], ['라운지', 4], ['베이', 4], ['포레스트', 3], ['호스텔', 1], ['게스트하우스', 2],
];
const SUFFIX = ['호텔', '호텔 & 리조트', '호텔', '호텔', '리조트', ''];
const AMENITIES = ['무료 Wi-Fi', '수영장', '피트니스', '주차', '스파', '공항 셔틀', '레스토랑', '바', '반려동물 동반', '주방'];
const COLORS = ['#0f766e', '#1d4ed8', '#7c3aed', '#be185d', '#c2410c', '#15803d', '#0369a1', '#a16207'];

// 문자열 → 32bit 시드
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32 PRNG
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function findCity(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return (
    CITIES.find((c) => c.name === query.trim() || c.en.toLowerCase() === q) ||
    CITIES.find((c) => c.name.includes(q) || q.includes(c.name) || c.en.toLowerCase().includes(q))
  );
}

// 날짜별 수요 계수 (주말·성수기 할증)
function demandFactor(checkIn, n) {
  let f = 0;
  const d = new Date(checkIn + 'T00:00:00');
  for (let i = 0; i < n; i++) {
    const day = new Date(d.getTime() + i * 86400000);
    const dow = day.getDay();
    const m = day.getMonth() + 1;
    let x = dow === 5 || dow === 6 ? 1.25 : 1;
    if (m === 7 || m === 8 || m === 12 || m === 1) x *= 1.15;
    f += x;
  }
  return f / n;
}

const round100 = (v) => Math.round(v / 100) * 100;

function buildHotels(city, query) {
  // 호텔 목록 자체는 도시별로 고정 (날짜가 바뀌어도 같은 호텔)
  const r = rng(hash('hotels:' + city.name));
  const count = 14 + Math.floor(r() * 8);
  const used = new Set();
  const hotels = [];
  while (hotels.length < count) {
    const area = city.areas[Math.floor(r() * city.areas.length)];
    const [style, baseStars] = STYLES[Math.floor(r() * STYLES.length)];
    const suffix = SUFFIX[Math.floor(r() * SUFFIX.length)];
    const name = `${area} ${style}${suffix ? ' ' + suffix : ''}`.trim();
    if (used.has(name)) continue;
    used.add(name);
    const stars = Math.min(5, Math.max(1, baseStars + (r() < 0.25 ? -1 : 0)));
    const rating = Math.min(9.8, 6.4 + stars * 0.45 + r() * 1.4);
    const amen = AMENITIES.filter(() => r() < 0.25 + stars * 0.08);
    hotels.push({
      id: `demo-${hash(city.name + name).toString(36)}`,
      name,
      city: city.name,
      area,
      stars,
      rating: Math.round(rating * 10) / 10,
      reviews: Math.floor(80 + r() * 4200),
      amenities: amen.length ? amen : ['무료 Wi-Fi'],
      distance: Math.round((0.2 + r() * 6) * 10) / 10,
      color: COLORS[Math.floor(r() * COLORS.length)],
      priceIndex: (0.45 + stars * 0.22) * (0.8 + r() * 0.5),
      searchName: `${name} ${city.en}`,
      _query: query,
    });
  }
  return hotels;
}

export async function searchDemo(params) {
  const city = findCity(params.destination);
  // 네트워크 지연 흉내
  await new Promise((res) => setTimeout(res, 450 + Math.random() * 400));
  if (!city) {
    return { hotels: [], city: null, demo: true };
  }
  const n = nights(params.checkIn, params.checkOut);
  const demand = demandFactor(params.checkIn, n);
  const occupancy = 1 + Math.max(0, params.adults - 2) * 0.18;
  const siteKeys = Object.keys(SITES);

  const hotels = buildHotels(city, params.destination).map((h) => {
    const r = rng(hash(`${h.id}|${params.checkIn}|${params.checkOut}|${params.adults}|${params.rooms}`));
    const nightly = city.base * h.priceIndex * demand * occupancy * (0.9 + r() * 0.2);
    // 일부 사이트는 해당 호텔을 판매하지 않음
    const offers = siteKeys
      .filter(() => r() > 0.18)
      .map((key) => {
        const spread = 0.88 + r() * 0.24; // 사이트별 ±12% 가격 차이
        const perNight = round100(nightly * spread);
        const freeCancel = r() < 0.55;
        const breakfast = r() < 0.3;
        const total = perNight * n * params.rooms;
        return {
          site: key,
          siteName: SITES[key].name,
          perNight,
          total,
          freeCancel,
          breakfast,
          url: SITES[key].url(h.searchName, params),
        };
      });
    if (!offers.length) {
      const key = siteKeys[Math.floor(r() * siteKeys.length)];
      const perNight = round100(nightly);
      offers.push({ site: key, siteName: SITES[key].name, perNight, total: perNight * n * params.rooms, freeCancel: false, breakfast: false, url: SITES[key].url(h.searchName, params) });
    }
    const { _query, priceIndex, ...rest } = h;
    return { ...rest, offers };
  });

  return { hotels, city: city.name, demo: true };
}
