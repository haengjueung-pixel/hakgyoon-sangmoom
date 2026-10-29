import { NextResponse } from "next/server";
import { neisGet, schoolParams, ymd } from "@/lib/neis";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = ymd(searchParams.get("date") || new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }));
    const grade = searchParams.get("grade");
    const classroom = searchParams.get("class");
    if (!grade || !classroom) return NextResponse.json({ ok: false, error: "grade와 class 값을 입력하세요." }, { status: 400 });
    const data = await neisGet("hisTimetable", {
      ...schoolParams(), ALL_TI_YMD: date, GRADE: grade, CLASS_NM: classroom
    });
    return NextResponse.json({ ok: true, timetable: data.hisTimetable?.[1]?.row ?? [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "시간표 조회 실패" }, { status: 500 });
  }
}
