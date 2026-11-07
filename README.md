# 최저가 호텔 (PWA)

여러 예약 사이트(아고다, 부킹닷컴, 호텔스닷컴, 익스피디아, 트립닷컴)의 호텔 가격을 비교해서
**최저가 순**으로 보여주는 설치형 웹앱(PWA)입니다. 빌드 과정 없이 정적 파일만으로 동작합니다.

## 기능
- 목적지 · 체크인/체크아웃 · 인원 · 객실로 검색
- 호텔별로 사이트 가격을 비교하고, 최저가 사이트와 절약 금액 표시
- 정렬(가격/평점/성급/할인폭), 성급 필터, 최대 가격 슬라이더, 무료 취소 필터
- 각 사이트로 같은 조건의 검색 페이지 바로 열기 + Google 호텔 비교 링크
- 찜 목록, 최근 검색(localStorage), 검색 조건 공유 URL(`?d=서울&in=2026-12-01&out=2026-12-03`)
- 홈 화면 설치, 오프라인 실행(서비스 워커), 다크 모드

## 실행
```bash
python3 -m http.server 8080
# http://localhost:8080 접속
```
서비스 워커는 `localhost` 또는 HTTPS에서만 동작합니다. GitHub Pages, Netlify, Vercel 등에 그대로 올리면 됩니다.

## 데모 모드와 실제 가격 연동
기본값은 **데모 모드**입니다. 호텔 이름과 가격은 도시·날짜·인원에 따라 생성된 가상 데이터예요.
주말·성수기에는 가격이 올라가도록 만들었습니다. 사이트 링크는 실제 사이트에서 같은 조건으로 검색합니다.

실제 가격을 쓰려면 제휴/공급사 API를 호출하는 백엔드를 만들고 `js/config.js` 의 `API_ENDPOINT` 에
그 주소를 넣으세요. API 키는 브라우저 코드에 넣지 말고 백엔드에 두세요.

### API 응답 형식
`GET {API_ENDPOINT}?destination=&checkIn=&checkOut=&adults=&rooms=`
```json
{
  "city": "서울",
  "hotels": [
    {
      "id": "h1", "name": "호텔 이름", "area": "명동", "stars": 4,
      "rating": 8.7, "reviews": 1234, "distance": 0.8,
      "amenities": ["무료 Wi-Fi", "피트니스"],
      "offers": [
        { "site": "agoda", "siteName": "아고다", "perNight": 120000, "total": 240000,
          "freeCancel": true, "breakfast": false, "url": "https://..." }
      ]
    }
  ]
}
```
`total` 은 숙박 기간과 객실 수를 모두 반영한 총액입니다. 앱이 오퍼를 가격순으로 정렬하고 최저가를 계산합니다.

## 파일 구조
```
index.html            화면
styles.css            스타일 (라이트/다크)
manifest.webmanifest  PWA 매니페스트
sw.js                 서비스 워커 (오프라인 캐시)
js/app.js             UI 로직
js/api.js             검색 API 래퍼 (데모/실제 API 전환)
js/demo-provider.js   데모 데이터 생성
js/sites.js           예약 사이트 목록과 검색 링크
js/config.js          API 설정
icons/                앱 아이콘
```
