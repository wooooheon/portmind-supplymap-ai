import { prisma } from "@/lib/db/prisma";
import { maskSecret } from "@/lib/utils/json";

export type ApiKeyStatus = {
  provider: string;
  label: string;
  envKeyName: string;
  envPresent: boolean;
  storedMaskedValue?: string | null;
};

export const KEY_ENV_NAMES = [
  "DATA_GO_KR_SERVICE_KEY",
  "MFDS_IMPORT_FOOD_FOREIGN_MANUFACTURERS_SERVICE_KEY",
  "MFDS_COSMETICS_SERVICE_KEY",
  "MFDS_MEDICAL_DEVICE_SERVICE_KEY",
  "CUSTOMS_CONFIRMATION_ITEMS_SERVICE_KEY",
  "FOODS_SAFETY_KOREA_KEY",
  "SAFETY_KOREA_API_KEY",
  "UNIPASS_API_KEY",
  "UNIPASS_HS_NAVIGATION_KEY",
  "UNIPASS_HS_CODE_SEARCH_KEY",
  "UNIPASS_TARIFF_RATE_KEY",
  "UNIPASS_TARIFF_FX_KEY",
  "UNIPASS_CUSTOMS_REQUIREMENT_KEY",
  "UNIPASS_REQUIREMENT_APPROVAL_KEY",
  "UNIPASS_INSPECTION_QUARANTINE_KEY",
  "UNIPASS_CARGO_PROGRESS_KEY",
  "UNIPASS_OVERSEAS_SUPPLIER_KEY",
  "KIPRIS_PLUS_KEY",
  "LAW_OPEN_DATA_OC",
  "VWORLD_API_KEY",
  "KAKAO_REST_API_KEY",
  "NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY",
  "KAKAO_NATIVE_APP_KEY",
  "NAVER_MAPS_CLIENT_ID",
  "NAVER_MAPS_CLIENT_SECRET",
  "AMAP_WEB_SERVICE_KEY",
  "NEXT_PUBLIC_AMAP_JS_KEY",
  "GOOGLE_MAPS_API_KEY",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
  "BAIDU_MAP_AK",
  "BRAVE_SEARCH_API_KEY",
  "TAVILY_API_KEY",
  "GOOGLE_CUSTOM_SEARCH_API_KEY",
  "GOOGLE_CUSTOM_SEARCH_CX"
] as const;

export async function listApiKeyStatuses(): Promise<ApiKeyStatus[]> {
  const saved = await prisma.apiKey.findMany();
  return KEY_ENV_NAMES.map((envKeyName) => {
    const stored = saved.find((item) => item.envKeyName === envKeyName);
    return {
      provider: envKeyName.split("_")[0],
      label: envKeyName,
      envKeyName,
      envPresent: Boolean(process.env[envKeyName]),
      storedMaskedValue: stored?.maskedValue
    };
  });
}

export async function saveApiKeyMask(envKeyName: string, value: string) {
  if (!KEY_ENV_NAMES.includes(envKeyName as (typeof KEY_ENV_NAMES)[number])) {
    throw new Error(`Unsupported key ${envKeyName}`);
  }
  const maskedValue = maskSecret(value);
  return prisma.apiKey.upsert({
    where: {
      provider_label: {
        provider: envKeyName.split("_")[0],
        label: envKeyName
      }
    },
    update: {
      maskedValue,
      envKeyName
    },
    create: {
      provider: envKeyName.split("_")[0],
      label: envKeyName,
      maskedValue,
      envKeyName
    }
  });
}
