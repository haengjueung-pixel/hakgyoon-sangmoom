const BASE = "https://open.neis.go.kr/hub";

function apiKey() {
  const key = process.env.NEIS_API_KEY;
  if (!key) throw new Error("NEIS_API_KEY가 설정되지 않았습니다.");
  return key;
}

export async function neisGet(endpoint: string, params: Record<string, string | number | undefined>) {
  const url = new URL(`${BASE}/${endpoint}`);
  url.searchParams.set("KEY", apiKey());
  url.searchParams.set("Type", "json");
  url.searchParams.set("pIndex", "1");
  url.searchParams.set("pSize", "100");
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && String(v).trim() !== "") url.searchParams.set(k, String(v));
  });
  const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`NEIS 요청 실패 (${res.status})`);
  const json = await res.json();
  const error = json?.RESULT;
  if (error && error.CODE !== "INFO-000") throw new Error(error.MESSAGE || error.CODE);
  return json;
}

export function schoolParams() {
  const office = process.env.NEIS_ATPT_OFCDC_SC_CODE || "B10";
  const school = process.env.NEIS_SD_SCHUL_CODE;
  if (!school) throw new Error("NEIS_SD_SCHUL_CODE가 비어 있습니다. 학교검색 결과에서 코드를 확인해 .env.local에 설정하세요.");
  return { ATPT_OFCDC_SC_CODE: office, SD_SCHUL_CODE: school };
}

export function ymd(date: string) {
  return date.replaceAll("-", "");
}
