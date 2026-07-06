# AGENTS.md

## Project Goal

SupplyMap AI is an MVP for the "제품·서비스 개발" track of the 산업통상부 공공데이터 활용 아이디어 공모전.

The product direction is a domestic-first supply chain discovery and import risk analysis platform. The service must start from Korean industrial complex and domestic factory public data, then expand to overseas factory candidates, certification, customs, recall, country risk, and evidence-grounded AI trade guidance.

Core service concept:

- Help Korean SMEs and small merchants evaluate domestic substitute supply before importing.
- Use MOTIE and affiliated public institution data as the primary evidence layer.
- Use other public data and private/overseas data only as supporting layers.
- Present results as map layers, candidate comparison, risk scores, RAG chatbot answers, evidence drawers, and report preview.

## Current Stack

- Next.js App Router
- Prisma
- SQLite
- Tailwind CSS
- Existing large legacy DB models:
  - `Factory`
  - `Product`
  - `Certificate`
  - `RiskEvent`
- SupplyMap competition models:
  - `SupplyDataSource`
  - `IndustrialComplex`
  - `Supplier`
  - `RiskSignal`
  - `ChatEvidence`

## Architecture Rules

- Do not create duplicate `DataSource`, `Supplier`, or `RiskSignal` models.
- Use the existing `SupplyDataSource` model as the source-of-truth for competition data provenance.
- Keep legacy `ApiSource` as the ingestion source model for existing tools; do not make it the main competition provenance model.
- Reuse the existing `Factory` DB as the overseas/supporting supply layer.
- Do not convert the large `Factory` DB into domestic `Supplier` records in bulk.
- Domestic `Supplier` and `IndustrialComplex` data must be the first step in the main SupplyMap analysis flow.
- Overseas factories, Google Maps, AMap, Alibaba, 1688, Made-in-China, and user-supplied overseas data must be clearly marked as supporting data.
- Always preserve and display `sourceType`:
  - `MOTIE_PUBLIC`
  - `OTHER_PUBLIC`
  - `PRIVATE`
  - `USER_UPLOAD`
- Every candidate, risk signal, chatbot evidence item, and report section should keep provenance fields where possible:
  - `providerName`
  - `datasetName`
  - `sourceType`
  - `sourceUrl`
  - `fetchedAt`
  - `license`
- `/supplymap` is the main competition flow.
- `/data-catalog` is the competition evidence/source catalog page.
- `/heatmap`, `/map`, `/factories`, and older chatbot pages are legacy or supporting tools and should not replace the domestic-first SupplyMap flow.

## AI/RAG Rules

- LLM answers must use only retrieved structured data and evidence records.
- Do not invent facts about suppliers, certifications, HS codes, customs requirements, recall status, or country risk.
- If evidence is missing or weak, answer with "확인 필요".
- HS codes are candidates unless verified by the relevant authority.
- Certification, customs, recall, safety, and legal statements must not be written as final judgment.
- Use wording such as:
  - "후보"
  - "확인 필요"
  - "관계기관 확인 필요"
  - "의사결정 보조"
- Avoid wording that implies final legal, customs, certification, safety, or transaction approval.
- Every chatbot answer should connect to evidence records.
- Evidence should be visible through `EvidenceDrawer`.
- UI surfaces should show source badges for evidence and data records.
- Judge/demo chatbot paths should avoid slow or fragile external LLM calls unless explicitly enabled.

## Demo Rules

- Judge Demo Mode must work without API keys.
- Keep mock fallback paths for all critical adapters and chatbot/report flows.
- Do not remove seed/demo data just because real API integration exists.
- The demo should be understandable by judges within 3 minutes.
- Prioritize stable, repeatable UX over broad but fragile live integrations.
- Recommended demo flow:
  1. Open `/data-catalog` to show MOTIE and supporting data sources.
  2. Open `/supplymap`.
  3. Click Judge Demo Mode / sample product.
  4. Show domestic candidate first.
  5. Compare overseas supporting candidates.
  6. Show risk panel.
  7. Ask the SupplyMap Copilot a question.
  8. Open Evidence Drawer.
  9. Show Report Preview.
- After running `npm run build` during local development, restart `next dev` before browser testing if CSS or chunk loading looks broken.

## Commands

Development server:

```bash
npm run dev
```

Production build:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

Prisma client generation:

```bash
npx prisma generate
```

Recommended demo preparation:

```bash
npm run seed:supplymap
npm run typecheck
npm run lint
npm run build
```

