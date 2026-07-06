import type { TradeAssistantIntent } from "./types";

const sourceRules: Array<{ sources: string[]; patterns: RegExp[] }> = [
  {
    sources: ["customs_hs_code", "customs_confirmation_items", "customs_trade_stats_by_hs_country"],
    patterns: [/hs\s?\d{2,10}/i, /관세|통관|수입요건|세관장|hs ?code|수출입|무역통계/i]
  },
  {
    sources: ["safety_korea_cert_recall", "rra_conformity"],
    patterns: [/kc|전파|rra|적합성|인증|리콜|제품안전/i]
  },
  {
    sources: ["mfds_import_food_foreign_manufacturers", "mfds_import_food_suspended_manufacturers"],
    patterns: [/식품|수입식품|해외제조업소|건기식|건강기능|축산물|수산물|과자|비스킷|가공식품|농산물|식품첨가물|기구|용기|포장/i]
  },
  {
    sources: ["mfds_cosmetic_ingredients", "mfds_cosmetic_restricted_ingredients", "customs_confirmation_items"],
    patterns: [/화장품|코스메틱|cosmetic|원료|성분|사용제한|금지성분|제한성분|cas\s?no|cas번호/i]
  },
  {
    sources: ["mfds_medical_device_items"],
    patterns: [/의료기기|의료 기기|품목허가|의료기기 등급|허가번호|제조국/i]
  },
  {
    sources: ["energy_efficiency_products", "standby_power_products"],
    patterns: [/에너지|효율등급|대기전력|소비효율|한국에너지공단/i]
  },
  {
    sources: ["kipris_ip_search"],
    patterns: [/상표|특허|디자인|지식재산|kipris|ip 리스크/i]
  },
  {
    sources: ["brave_search", "tavily_search"],
    patterns: [/소송|행정처분|부정|검색|뉴스|평판|위험/i]
  }
];

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function extractHsCode(prompt: string): string | undefined {
  const match = prompt.match(/(?:HS\s*CODE|HS|에이치에스|품목번호)?\s*([0-9]{4}(?:[.\-\s]?[0-9]{2}){0,3})/i);
  return match?.[1]?.replace(/[.\-\s]/g, "");
}

function extractCountry(prompt: string): string | undefined {
  if (/중국|china|\bcn\b/i.test(prompt)) return "CN";
  if (/미국|usa|united states|\bus\b/i.test(prompt)) return "US";
  if (/베트남|vietnam|\bvn\b/i.test(prompt)) return "VN";
  if (/한국|대한민국|korea|\bkr\b/i.test(prompt)) return "KR";
  return undefined;
}

function extractLocationTerms(prompt: string): string[] {
  const terms: string[] = [];
  if (/심천|선전|shenzhen|深圳/i.test(prompt)) terms.push("Shenzhen");
  if (/광동|광둥|guangdong|广东/i.test(prompt)) terms.push("Guangdong");
  if (/상하이|shanghai|上海/i.test(prompt)) terms.push("Shanghai");
  if (/베이징|북경|beijing|北京/i.test(prompt)) terms.push("Beijing");
  if (/칭다오|청도|qingdao|青岛/i.test(prompt)) terms.push("Qingdao");
  if (/동관|둥관|dongguan|东莞/i.test(prompt)) terms.push("Dongguan");
  if (/광저우|광주|guangzhou|广州/i.test(prompt)) terms.push("Guangzhou");
  if (/이우|yiwu|义乌/i.test(prompt)) terms.push("Yiwu");
  if (/샤먼|하문|xiamen|厦门/i.test(prompt)) terms.push("Xiamen");
  return uniq(terms);
}

function extractProductTerms(prompt: string): string[] {
  const quoted = Array.from(prompt.matchAll(/["“](.+?)["”]/g)).map((match) => match[1].trim());
  const categoryHints = [
    /기구\s*[·ㆍ,/]?\s*용기\s*[·ㆍ,/]?\s*포장|기구|용기|포장|식품용기|포장재/i.test(prompt) ? "기구·용기·포장" : null,
    /가공식품|가공 식품|processed food/i.test(prompt) ? "가공식품" : null,
    /식품첨가물|첨가물/i.test(prompt) ? "식품첨가물" : null,
    /건강기능|건기식|건강 기능/i.test(prompt) ? "건강기능식품" : null,
    /농산물|농산/i.test(prompt) ? "농산물" : null,
    /수산물|수산/i.test(prompt) ? "수산물" : null,
    /화장품|코스메틱|원료|성분/i.test(prompt) ? "화장품" : null,
    /식품|과자|비스킷|농산물|수산물|건강기능|건기식|식품첨가물|용기|포장|processed food/i.test(prompt) ? "식품" : null,
    /의료기기|체온계|임플란트|의료 기기/i.test(prompt) ? "의료기기" : null,
    /스피커|블루투스|충전기|어댑터|전자/i.test(prompt) ? "전자제품" : null,
    /제습기|에너지|대기전력|효율/i.test(prompt) ? "전자제품" : null
  ].filter(Boolean) as string[];
  const koreanNouns = Array.from(prompt.matchAll(/[가-힣A-Za-z0-9+]{2,}(?:\s?[가-힣A-Za-z0-9+]{2,}){0,2}/g))
    .map((match) => match[0].trim())
    .map((term) => term.replace(/^(심천|선전|중국|광동|광둥)에?\s*(있는|소재|위치한)?\s*/i, "").trim())
    .filter((term) => term.length >= 2)
    .filter((term) => !/수입|무역|관련|알려|가능|확인|필요|중국|한국|미국|베트남|관세|통관|공장|찾아|추천|정리|자료|리스크|체크|어떻게|하려고|있어|대한|기반|바이어|업체|심천|선전|광동|광둥/.test(term))
    .slice(0, 8);
  const terms = uniq([...quoted, ...categoryHints, ...koreanNouns]);
  const hasSpecificFood = terms.some((term) => /가공식품|기구·용기·포장|식품첨가물|건강기능식품|농산물|수산물/.test(term));
  return terms.filter((term) => !(term === "식품" && hasSpecificFood)).slice(0, 10);
}

export function analyzeTradePrompt(prompt: string): TradeAssistantIntent {
  const selectedSources = new Set<string>();
  const warnings: string[] = [];

  for (const rule of sourceRules) {
    if (rule.patterns.some((pattern) => pattern.test(prompt))) {
      rule.sources.forEach((source) => selectedSources.add(source));
    }
  }

  if (selectedSources.size === 0) {
    ["customs_hs_code", "customs_confirmation_items", "customs_trade_stats_by_hs_country"].forEach((source) =>
      selectedSources.add(source)
    );
    warnings.push("질문에서 분야가 명확하지 않아 관세/통관 기본 소스를 우선 조회했습니다.");
  }

  const hsCode = extractHsCode(prompt);
  const country = extractCountry(prompt);
  const productTerms = extractProductTerms(prompt);
  const locationTerms = extractLocationTerms(prompt);

  return {
    query: prompt,
    hsCode,
    country,
    productTerms,
    locationTerms,
    selectedSources: Array.from(selectedSources).slice(0, 8),
    warnings
  };
}
