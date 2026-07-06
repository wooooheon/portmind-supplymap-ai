import fs from "node:fs";

function loadEnvFile() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

async function checkSdk(referer: string) {
  const key = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY가 없습니다.");
  const url = new URL("https://dapi.kakao.com/v2/maps/sdk.js");
  url.searchParams.set("appkey", key);
  url.searchParams.set("autoload", "false");
  url.searchParams.set("libraries", "services,clusterer");
  const response = await fetch(url, {
    headers: {
      Referer: referer,
      "User-Agent": "Mozilla/5.0"
    }
  });
  const text = await response.text();
  let message = text.slice(0, 180);
  try {
    const parsed = JSON.parse(text) as { errorType?: string; message?: string };
    message = [parsed.errorType, parsed.message].filter(Boolean).join(": ");
  } catch {
    message = response.ok ? "SDK JavaScript returned" : message;
  }
  return {
    referer,
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get("content-type"),
    message
  };
}

async function main() {
  loadEnvFile();
  const key = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
  const referers = [
    process.env.KAKAO_MAP_DIAGNOSE_REFERER,
    "http://127.0.0.1:3001/supplymap",
    "http://localhost:3001/supplymap"
  ].filter(Boolean) as string[];
  const uniqueReferers = Array.from(new Set(referers));
  const results = [];
  for (const referer of uniqueReferers) results.push(await checkSdk(referer));
  console.log(
    JSON.stringify(
      {
        envPresent: Boolean(key),
        keyLength: key?.length ?? 0,
        results
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
