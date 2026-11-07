import { API_ENDPOINT } from './config.js';
import { searchDemo } from './demo-provider.js';

// 결과를 공통 형식으로 정리: 오퍼를 가격순 정렬하고 최저가/최고가 정보를 붙인다.
function normalize(result) {
  const hotels = (result.hotels || [])
    .filter((h) => Array.isArray(h.offers) && h.offers.length)
    .map((h) => {
      const offers = [...h.offers].sort((a, b) => a.total - b.total);
      const best = offers[0];
      const worst = offers[offers.length - 1];
      return {
        ...h,
        offers,
        best,
        savings: worst.total - best.total,
        freeCancelAvailable: offers.some((o) => o.freeCancel),
      };
    });
  return { ...result, hotels };
}

export async function searchHotels(params) {
  if (API_ENDPOINT) {
    const qs = new URLSearchParams({
      destination: params.destination,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      adults: String(params.adults),
      rooms: String(params.rooms),
    });
    const res = await fetch(`${API_ENDPOINT}?${qs}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`API 오류 (${res.status})`);
    return normalize({ ...(await res.json()), demo: false });
  }
  return normalize(await searchDemo(params));
}

export const usingDemo = !API_ENDPOINT;
