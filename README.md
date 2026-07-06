# Trade Intelligence Map MVP

한국 바이어가 중국/해외 공장과 제품을 찾을 때, 정부/공공 API와 검색 API를 활용해 무역 데이터를 수집, 정규화, 저장하고 공장 위치를 지도에 표시하는 MVP입니다.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- SQLite by default, PostgreSQL-ready Prisma datasource
- Zod, React Hook Form
- TanStack Table
- Leaflet + marker clustering
- Node.js TypeScript ingestion scripts
- pnpm

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm db:prepare
pnpm prisma migrate dev
pnpm seed
pnpm dev
```

Open `http://localhost:3000`.

## CLI

```bash
pnpm data:ingest --source customs_hs_code
pnpm data:ingest --source customs_trade_stats_by_hs_country --country CN --hsCode 8518
pnpm data:ingest --source safety_korea_cert_recall --query "가습기"
pnpm data:ingest:all
pnpm data:export --entity factories --format csv
pnpm data:export --entity factories --format jsonl
pnpm data:geocode
```

All ingestion runs write:

- Raw API result: `data/raw/{source}/{yyyy-mm-dd}/{runId}.json`
- Normalized JSONL: `data/normalized/{source}/{yyyy-mm-dd}/{runId}.jsonl`
- Exports: `data/exports/*`

## Trade Prompt Assistant

Open `/assistant` and enter a trade/import prompt. The server:

1. Parses HS code, country, product terms, and relevant domains.
2. Pulls matching evidence from the local DB.
3. Calls relevant connectors such as customs, KC/RRA, MFDS, medical device, energy efficiency, and standby power sources.
4. Builds an augmented prompt with evidence.
5. Sends the augmented prompt to DeepSeek when `DEEPSEEK_API_KEY` is present.

If `DEEPSEEK_API_KEY` is missing or the LLM call fails, the feature returns a fallback answer using collected evidence only.

## Implemented Connectors

The app includes a common connector interface and stubs for all requested sources. The first implemented connectors are:

- `customs_hs_code`
- `customs_confirmation_items`
- `customs_trade_stats_by_hs_country`
- `safety_korea_cert_recall`
- `rra_conformity`
- `mfds_import_food_foreign_manufacturers`
- `mfds_import_food_suspended_manufacturers`

If an API key is missing, `MOCK_CONNECTORS=true`, or the live call fails, the connector returns mock records so UI, file writing, normalization, DB persistence, and exports continue to work.

## API Keys

Copy `.env.example` to `.env` and fill only the keys you have:

```bash
DATA_GO_KR_SERVICE_KEY=
FOODS_SAFETY_KOREA_KEY=
UNIPASS_API_KEY=
KIPRIS_PLUS_KEY=
LAW_OPEN_DATA_OC=
VWORLD_API_KEY=
KAKAO_REST_API_KEY=
NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY=
NAVER_MAPS_CLIENT_ID=
NAVER_MAPS_CLIENT_SECRET=
AMAP_WEB_SERVICE_KEY=
BAIDU_MAP_AK=
BRAVE_SEARCH_API_KEY=
TAVILY_API_KEY=
GOOGLE_CUSTOM_SEARCH_API_KEY=
GOOGLE_CUSTOM_SEARCH_CX=
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
```

Server-side keys must not use `NEXT_PUBLIC_`. Only browser-required keys, such as a map JavaScript key, should use `NEXT_PUBLIC_`.

Settings UI stores a masked key reference only. The real value should remain in `.env` for server-side calls.

## API Key / Docs Links

- Public Data Portal: https://www.data.go.kr
- 관세청 품목별 국가별 수출입실적: https://www.data.go.kr/data/15101602/openapi.do
- 세관장확인대상물품: https://www.data.go.kr/data/15101589/openapi.do
- MFDS 수입식품 해외제조업소 정보: https://www.data.go.kr/data/15073967/openapi.do
- Food Safety Korea API: https://www.foodsafetykorea.go.kr/apiMain.do
- UNI-PASS: https://unipass.customs.go.kr
- KIPRIS Plus: https://plus.kipris.or.kr
- 국가법령정보 Open API: https://open.law.go.kr
- Kakao Local API: https://developers.kakao.com/docs/latest/ko/local/dev-guide
- VWorld: https://www.vworld.kr/dev/v4dv_geocoderguide2_s001.do
- AMap Web Service: https://lbs.amap.com/api/webservice/guide/api/georegeo
- Baidu Map Geocoding: https://lbsyun.baidu.com/faq/api?title=webapi/guide/webservice-geocoding
- Brave Search API: https://api-dashboard.search.brave.com/app/documentation
- Tavily: https://docs.tavily.com
- Google Custom Search JSON API: https://developers.google.com/custom-search/v1/overview

## Endpoint Overrides

Some Korean institution LINK APIs expose search endpoints that can change or require query parameters not shown in generic discovery pages. Override any default endpoint in `.env`:

```bash
CUSTOMS_HS_CODE_ENDPOINT=
CUSTOMS_CONFIRMATION_ITEMS_ENDPOINT=
CUSTOMS_TRADE_STATS_BY_HS_COUNTRY_ENDPOINT=
SAFETY_KOREA_CERT_RECALL_ENDPOINT=
RRA_CONFORMITY_ENDPOINT=
MFDS_IMPORT_FOOD_FOREIGN_MANUFACTURERS_ENDPOINT=
MFDS_IMPORT_FOOD_SUSPENDED_MANUFACTURERS_ENDPOINT=
MFDS_MEDICAL_DEVICE_ITEMS_ENDPOINT=
ENERGY_EFFICIENCY_PRODUCTS_ENDPOINT=
STANDBY_POWER_PRODUCTS_ENDPOINT=
```

## CSV Import

Allowed factory CSV columns:

- `canonicalName`
- `chineseName`
- `englishName`
- `country`
- `province`
- `city`
- `addressRaw`
- `productCategory`
- `productName`
- `website`
- `sourceUrl`

Deduplication uses `canonicalName + country + city + addressRaw`.

## Scoring

`Import Readiness Score` is a simple 0-100 MVP rule score:

- Official data match: +25
- Certificate match: +20
- Trade requirements present: +15
- No high-risk risk events: +20
- High-confidence geocode: +10
- No negative search signal: +10
- Recall, suspension, non-compliance, or certificate cancellation subtracts points

This score does not replace legal, customs, or product safety review.

## Map

The MVP uses Leaflet + OpenStreetMap. Marker colors:

- Gray/yellow-like unknown: insufficient or unverified data
- Green: official data match and no high-risk event
- Yellow: partial verification or medium risk
- Red: recall, suspension, non-compliance, certification cancellation, or other high-risk signal

China geocoding supports AMap and Baidu. AMap coordinates are treated as GCJ-02 and converted to WGS84 for display. Baidu coordinates are treated as BD-09 and converted to WGS84.

## Safety Language

The UI intentionally avoids “government-certified safe factory.” It uses:

> 공식 공개 데이터와 사용자가 제공한 자료를 기준으로 확인된 정보

“확인되지 않음” means “추가 확인 필요,” not “문제없음.”
