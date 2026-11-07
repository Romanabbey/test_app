// 실제 가격 API 연결 설정
// API_ENDPOINT 를 비워두면 앱에 내장된 데모 데이터로 동작합니다.
// 실제 서비스에서는 예약사이트/제휴 API(Amadeus, Agoda Affiliate, Booking Affiliate 등)를
// 호출하는 자체 백엔드를 만들고 그 주소를 여기에 넣으세요. (API 키는 브라우저에 두지 마세요.)
//
// 백엔드는 GET {API_ENDPOINT}?destination=&checkIn=&checkOut=&adults=&rooms= 요청에
// README.md 의 "API 응답 형식" 과 같은 JSON 을 반환해야 합니다.
export const API_ENDPOINT = '';

export const CURRENCY = 'KRW';
