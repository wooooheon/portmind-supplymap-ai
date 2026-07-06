export function pickString(record: unknown, keys: string[]): string | null {
  if (!record || typeof record !== "object") return null;
  const map = record as Record<string, unknown>;
  const lowerMap = new Map(Object.entries(map).map(([key, value]) => [key.toLowerCase(), value]));

  for (const key of keys) {
    const exact = map[key];
    const lower = lowerMap.get(key.toLowerCase());
    const value = exact ?? lower;
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return null;
}

export function pickNumber(record: unknown, keys: string[]): number | null {
  const value = pickString(record, keys);
  if (!value) return null;
  const normalized = Number(value.replaceAll(",", ""));
  return Number.isFinite(normalized) ? normalized : null;
}

export function normalizeDate(value: string | null): string | null {
  if (!value) return null;
  const compact = value.replaceAll(".", "-").replaceAll("/", "-");
  const parsed = new Date(compact);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function sourceRecordId(record: unknown, fallbackParts: Array<string | null | undefined>): string | null {
  const id =
    pickString(record, ["id", "seq", "serialNo", "sn", "certNo", "certNum", "issuNo", "MST_ID", "PRDLST_CD"]) ??
    fallbackParts.filter(Boolean).join(":");
  return id || null;
}
