// 예약 사이트 정보와, 해당 사이트에서 같은 조건으로 바로 검색할 수 있는 링크 생성기

const enc = encodeURIComponent;

function nights(checkIn, checkOut) {
  return Math.max(1, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000));
}

export const SITES = {
  agoda: {
    name: '아고다',
    url: (q, s) =>
      `https://www.agoda.com/ko-kr/search?textToSearch=${enc(q)}&checkIn=${s.checkIn}&los=${nights(s.checkIn, s.checkOut)}&adults=${s.adults}&rooms=${s.rooms}`,
  },
  booking: {
    name: '부킹닷컴',
    url: (q, s) =>
      `https://www.booking.com/searchresults.ko.html?ss=${enc(q)}&checkin=${s.checkIn}&checkout=${s.checkOut}&group_adults=${s.adults}&no_rooms=${s.rooms}`,
  },
  hotels: {
    name: '호텔스닷컴',
    url: (q, s) =>
      `https://kr.hotels.com/Hotel-Search?destination=${enc(q)}&startDate=${s.checkIn}&endDate=${s.checkOut}&adults=${s.adults}&rooms=${s.rooms}`,
  },
  expedia: {
    name: '익스피디아',
    url: (q, s) =>
      `https://www.expedia.co.kr/Hotel-Search?destination=${enc(q)}&startDate=${s.checkIn}&endDate=${s.checkOut}&adults=${s.adults}&rooms=${s.rooms}`,
  },
  trip: {
    name: '트립닷컴',
    url: (q, s) =>
      `https://kr.trip.com/hotels/list?keyword=${enc(q)}&checkin=${s.checkIn.replaceAll('-', '/')}&checkout=${s.checkOut.replaceAll('-', '/')}&adult=${s.adults}&crn=${s.rooms}`,
  },
};

export function googleHotelsUrl(q, s) {
  return `https://www.google.com/travel/search?q=${enc(q)}&checkin=${s.checkIn}&checkout=${s.checkOut}&hl=ko`;
}

export { nights };
