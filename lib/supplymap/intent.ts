import type { ProductIntent, SupplyMapAnalysisRequest } from "./types";

type ProductRule = {
  patterns: RegExp[];
  category: string;
  hsCodes: string[];
  keywords: string[];
};

const PRODUCT_RULES: ProductRule[] = [
  {
    patterns: [/포장|용기|보틀|병|캡|뚜껑|패키지/i],
    category: "기구·용기·포장",
    hsCodes: ["392330", "392350", "392390"],
    keywords: ["포장", "용기", "플라스틱", "패키지"]
  },
  {
    patterns: [/전기히터|전열기|온풍기|ptc\s?히터|heater/i],
    category: "전열기기",
    hsCodes: ["851629", "851680", "851610"],
    keywords: ["전기히터", "전열기", "히터", "온풍기"]
  },
  {
    patterns: [/led|조명|등기구|스마트\s?조명/i],
    category: "LED 조명",
    hsCodes: ["940542", "940549", "853950"],
    keywords: ["LED", "조명", "등기구", "전원공급장치"]
  },
  {
    patterns: [/드론|무인기|uav/i],
    category: "드론 부품",
    hsCodes: ["880790", "852990", "850760"],
    keywords: ["드론", "제어보드", "센서", "프레임", "배터리팩"]
  },
  {
    patterns: [/과자|비스킷|스낵|가공식품/i],
    category: "가공식품",
    hsCodes: ["190531", "190590"],
    keywords: ["가공식품", "과자", "스낵", "식품"]
  },
  {
    patterns: [/화장품|크림|로션|세럼|코스메틱/i],
    category: "화장품",
    hsCodes: ["330499"],
    keywords: ["화장품", "크림", "로션", "코스메틱"]
  },
  {
    patterns: [/블루투스|스피커|전자|충전기|어댑터|제습기/i],
    category: "전기전자",
    hsCodes: ["851821", "851822", "850440"],
    keywords: ["전자제품", "전자부품", "블루투스", "스피커"]
  },
  {
    patterns: [/의료기기|체온계|진단|임플란트/i],
    category: "의료기기",
    hsCodes: ["901890", "902519"],
    keywords: ["의료기기", "체온계", "진단"]
  }
];

function compactWords(value: string): string[] {
  const stop = /수입|조달|공급|업체|회사|공장|찾아|추천|원해|하려고|대한|관련|후보|분석|희망|국가|지역/i;
  return Array.from(value.matchAll(/[가-힣A-Za-z0-9+·]{2,}/g))
    .map((match) => match[0])
    .filter((word) => !stop.test(word));
}

export function extractProductIntent(request: SupplyMapAnalysisRequest): ProductIntent {
  const query = request.productName.trim();
  const rule = PRODUCT_RULES.find((item) => item.patterns.some((pattern) => pattern.test(query)));
  const inputWords = compactWords(query);
  const hsCodeCandidates = Array.from(new Set([request.hsCode, ...(rule?.hsCodes ?? [])].filter(Boolean) as string[]));
  const keywords = Array.from(new Set([...(rule?.keywords ?? []), ...inputWords])).slice(0, 8);

  return {
    query,
    keywords,
    category: rule?.category ?? "품목 확인 필요",
    hsCode: request.hsCode || hsCodeCandidates[0],
    hsCodeCandidates,
    importCountry: request.importCountry || "CN",
    preferredRegion: request.preferredRegion || "전국"
  };
}
