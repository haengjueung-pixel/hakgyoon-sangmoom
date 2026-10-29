 "use client";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Utensils, ClipboardList, Bell, RefreshCw, LogOut, UserRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { siteConfig } from "@/lib/site-config";

type Meal = { MMEAL_SC_NM?: string; MLSV_YMD?: string; DDISH_NM?: string; CAL_INFO?: string; ORPLC_INFO?: string };
type Event = { AA_YMD?: string; EVENT_NM?: string; EVENT_CNTNT?: string; SBTR_DD_SC_NM?: string };
type StudentProfile = { id: string; display_name: string; grade: number | null; class_no: number | null; class_verified: boolean };
type ClassNotice = { id: string; title: string; subject: string; description: string; due_date: string | null; grade: number; class_no: number; created_by: string; created_at: string };
type TimetableRow = { ALL_TI_YMD?: string; PERIO?: string; ITRT_CNTNT?: string; GRADE?: string; CLASS_NM?: string };
const dateNow = () => new Date().toLocaleDateString("sv-SE", {timeZone:"Asia/Seoul"});
const pretty = (v?:string) => v ? `${v.slice(0,4)}.${v.slice(4,6)}.${v.slice(6,8)}` : "날짜 미정";

export default function Home() {
  const [date,setDate]=useState(dateNow());
  const [meals,setMeals]=useState<Meal[]>([]);
  const [events,setEvents]=useState<Event[]>([]);
  const [timetable,setTimetable]=useState<TimetableRow[]>([]);
  const [timetableMessage,setTimetableMessage]=useState("");
  const [profile,setProfile]=useState<StudentProfile|null>(null);
  const [notices,setNotices]=useState<ClassNotice[]>([]);
  const [noticeLoading,setNoticeLoading]=useState(false);
  const [noticeError,setNoticeError]=useState("");
  const [remindersEnabled,setRemindersEnabled]=useState(false);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [schoolSearch,setSchoolSearch]=useState<any[]>([]);
  const [grade,setGrade]=useState("1");
  const [classNo,setClassNo]=useState("1");
  const [showTask,setShowTask]=useState(false);
  const [editingNoticeId,setEditingNoticeId]=useState<string|null>(null);
  const [title,setTitle]=useState("");
  const [subject,setSubject]=useState("");
  const [due,setDue]=useState("");
  const [desc,setDesc]=useState("");
  const [authMode,setAuthMode]=useState<"login"|"signup">("login");
  const [authUser,setAuthUser]=useState<User|null>(null);
  const [authReady,setAuthReady]=useState(false);
  const [authBusy,setAuthBusy]=useState(false);
  const [authMessage,setAuthMessage]=useState("");
  const [authError,setAuthError]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [displayName,setDisplayName]=useState("");
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const supabase = useMemo(() => supabaseConfigured ? createClient() : null, [supabaseConfigured]);
  const isApprovedTargetClass = Boolean(profile?.class_verified && profile.grade === 1 && profile.class_no === 1);

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
    supabase.auth.getSession().then(({data}) => {
      setAuthUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      setAuthReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  async function loadClassNotices() {
    if (!supabase || !authUser) {
      setProfile(null); setNotices([]); setNoticeLoading(false);
      return;
    }
    setProfile(null); setNotices([]); setNoticeLoading(true); setNoticeError("");
    const { data: p, error: profileErr } = await supabase.from("profiles").select("id,display_name,grade,class_no,class_verified").eq("id", authUser.id).maybeSingle();
    if (profileErr) { setNoticeError("학생 프로필을 불러오지 못했어요: " + profileErr.message); setNoticeLoading(false); return; }
    setProfile(p as StudentProfile | null);
    if (!p || !p.class_verified || p.grade !== 1 || p.class_no !== 1) {
      setNotices([]); setNoticeLoading(false); return;
    }
    const { data, error: noticeErr } = await supabase.from("class_assignment_notices").select("id,title,subject,description,due_date,grade,class_no,created_by,created_at").eq("grade", 1).eq("class_no", 1).order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
    if (noticeErr) setNoticeError("반별 공지를 불러오지 못했어요: " + noticeErr.message);
    setNotices((data || []) as ClassNotice[]);
    setNoticeLoading(false);
  }

  useEffect(() => { void loadClassNotices(); }, [supabase, authUser]);

  async function enableReminders() {
    if (!("Notification" in window)) { setNoticeError("이 브라우저는 알림을 지원하지 않아요."); return; }
    const permission = await Notification.requestPermission();
    if (permission === "granted") { setRemindersEnabled(true); setNoticeError(""); }
    else setNoticeError("브라우저 설정에서 상문마스터의 알림을 허용해 주세요.");
  }

  useEffect(() => {
    if (!remindersEnabled || typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
    const now = Date.now();
    notices.forEach((n) => {
      if (!n.due_date) return;
      const dueAt = new Date(`${n.due_date}T23:59:00+09:00`).getTime();
      const remaining = dueAt - now;
      const key = `sangmoon_notice_reminded_${n.id}`;
      if (remaining >= 0 && remaining <= 24 * 60 * 60 * 1000 && !localStorage.getItem(key)) {
        new Notification(`수행평가 마감 임박: ${n.subject}`, { body: `${n.title} · 마감 ${n.due_date}`, tag: n.id });
        localStorage.setItem(key, "1");
      }
    });
  }, [notices, remindersEnabled]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthBusy(true); setAuthMessage(""); setAuthError("");
    if (!supabase) {
      setAuthError("Supabase 설정이 아직 없습니다. 먼저 Supabase 프로젝트를 만들고 .env.local 환경변수를 입력하세요.");
      setAuthBusy(false); return;
    }
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              display_name: displayName.trim(),
              grade: "1",
              class_no: "1"
            }
          }
        });
        if (error) throw error;
        if (data.session) setAuthMessage("회원가입이 완료됐어요. 상문마스터에 로그인했습니다.");
        else setAuthMessage("가입 요청이 완료됐어요. 이메일 확인 링크를 누른 뒤 로그인해 주세요.");
        setPassword("");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setAuthMessage("로그인했어요.");
        setPassword("");
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "인증 중 문제가 발생했습니다.");
    } finally { setAuthBusy(false); }
  }

  async function handleSignOut() {
    if (!supabase) return;
    setAuthBusy(true); setAuthMessage(""); setAuthError("");
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError(error.message);
    else setAuthMessage("로그아웃했어요.");
    setAuthBusy(false);
  }

  async function load() {
    setLoading(true); setError("");
    try {
      const [m,c,t] = await Promise.all([
        fetch(`/api/meals?date=${date}`).then(r=>r.json()),
        fetch(`/api/calendar?from=${date.slice(0,4)}-01-01&to=${date.slice(0,4)}-12-31`).then(r=>r.json()),
        fetch(`/api/timetable?date=${date}&grade=1&class=1`).then(r=>r.json())
      ]);
      if(!m.ok) throw new Error(m.error);
      if(!c.ok) throw new Error(c.error);
      setMeals(m.meals || []); setEvents(c.events || []);
      setTimetable(t.ok ? (t.timetable || []) : []);
      setTimetableMessage(t.ok ? "" : (t.error || "시간표를 불러오지 못했습니다."));
    } catch(e) { setError(e instanceof Error?e.message:"데이터를 불러오지 못했습니다."); }
    finally {setLoading(false);}
  }
  async function findSchool() {
    try { const r=await fetch("/api/school-search?name="+encodeURIComponent("상문고등학교")+"&region="+encodeURIComponent("서울특별시")); const j=await r.json(); setSchoolSearch(j.data||[]); if(!j.ok) setError(j.error); }
    catch {setError("학교 검색에 실패했습니다.");}
  }
  useEffect(()=>{load(); findSchool();},[date]);

  async function addTask(e:React.FormEvent) {
    e.preventDefault();
    if (!supabase || !authUser || !profile?.class_verified || !profile.grade || !profile.class_no) {
      setNoticeError("로그인하고 학년·반 확인이 완료된 계정이어야 공지를 등록할 수 있어요.");
      return;
    }
    if (!title.trim() || !subject.trim()) return;
    setNoticeError("");
    const payload = { title: title.trim(), subject: subject.trim(), description: desc.trim(), due_date: due || null };
    const result = editingNoticeId
      ? await supabase.from("class_assignment_notices").update(payload).eq("id", editingNoticeId).eq("created_by", authUser.id)
      : await supabase.from("class_assignment_notices").insert({ ...payload, grade: 1, class_no: 1, created_by: authUser.id });
    if (result.error) { setNoticeError((editingNoticeId ? "공지 수정" : "공지 등록") + "에 실패했어요: " + result.error.message); return; }
    setTitle(""); setSubject(""); setDesc(""); setDue(""); setShowTask(false); setEditingNoticeId(null);
    await loadClassNotices();
  }
  function startEditNotice(n: ClassNotice) {
    setEditingNoticeId(n.id); setTitle(n.title); setSubject(n.subject); setDesc(n.description || ""); setDue(n.due_date || ""); setShowTask(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function deleteNotice(n: ClassNotice) {
    if (!supabase || !authUser || n.created_by !== authUser.id) return;
    if (!window.confirm(`'${n.title}' 공지를 삭제할까요?`)) return;
    const { error } = await supabase.from("class_assignment_notices").delete().eq("id", n.id).eq("created_by", authUser.id);
    if (error) setNoticeError("공지 삭제에 실패했어요: " + error.message); else await loadClassNotices();
  }
  const upcoming=events.filter(e=>e.AA_YMD && e.AA_YMD >= date.replaceAll("-","")).slice(0,7);
  const school=schoolSearch[0];
  return <>
    <header className="hero"><div className="brand">상문<span>마스터.</span> <small style={{fontSize:12,fontWeight:500,opacity:.8}}>{siteConfig.schoolName}</small></div><h1>{siteConfig.headline}</h1><p>{siteConfig.schoolName} {siteConfig.targetClassLabel} 전용 · {siteConfig.description}</p></header>
    <main className="wrap">
      <section className="card auth-card">
        <div className="row auth-heading"><h2><UserRound size={19} style={{verticalAlign:"middle",marginRight:7}}/>학생 회원가입 · 로그인</h2>{authUser && <span className="pill">로그인됨</span>}</div>
        {!supabaseConfigured ? <div className="auth-notice"><b>로그인 기능 설정이 필요해요.</b><p className="muted">아래 순서대로 Supabase 프로젝트와 환경변수를 연결하면 회원가입·로그인이 작동합니다.</p></div> : !authReady ? <p className="muted">로그인 상태 확인 중…</p> : authUser ? <div className="auth-signed-in"><p><b>{authUser.user_metadata?.display_name || "학생"}</b> 님, 환영합니다.</p><p className="muted">{authUser.email}</p><button className="btn alt" onClick={handleSignOut} disabled={authBusy}><LogOut size={15} style={{verticalAlign:"middle",marginRight:6}}/>로그아웃</button></div> : <>
          <div className="auth-tabs"><button type="button" className={authMode==="login"?"auth-tab active":"auth-tab"} onClick={()=>{setAuthMode("login");setAuthMessage("");setAuthError("");}}>로그인</button><button type="button" className={authMode==="signup"?"auth-tab active":"auth-tab"} onClick={()=>{setAuthMode("signup");setAuthMessage("");setAuthError("");}}>회원가입</button></div>
          <form className="form auth-form" onSubmit={handleAuth}>
            {authMode==="signup" && <><label>상문마스터에서 사용할 닉네임<input required maxLength={30} value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="실명 대신 닉네임 권장"/></label><div className="auth-notice"><b>이 사이트는 상문고등학교 1학년 1반 전용입니다.</b><p className="muted">가입 후 담당자가 반을 확인하고 승인해야 이용할 수 있어요.</p></div></>}
            <label>이메일<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="사용할 이메일 주소"/></label>
            <label>비밀번호<input required type="password" minLength={8} autoComplete={authMode==="signup"?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="8자 이상"/></label>
            <button className="btn" disabled={authBusy}>{authBusy?"처리 중…":authMode==="signup"?"회원가입":"로그인"}</button>
          </form>
          {authMessage && <p className="auth-success" role="status">{authMessage}</p>}
          {authError && <p className="error" role="alert">{authError}</p>}
          <p className="muted">이메일과 비밀번호를 안전하게 관리하고, 다른 사이트에서 쓰는 비밀번호를 재사용하지 마세요.</p>
        </>}
      </section>
      {!authUser ? <section className="card access-gate"><h2>1학년 1반 전용</h2><p className="muted">로그인 후 반 확인이 완료된 학생만 상문마스터의 게시판과 학교생활 메뉴를 이용할 수 있어요.</p></section> : !profile ? <section className="card access-gate"><h2>학생 정보 확인 중</h2><p className="muted">{noticeError || "프로필을 불러오고 있어요. 잠시 기다려 주세요."}</p></section> : !isApprovedTargetClass ? <section className="card access-gate"><h2>이용 승인 대기 또는 접근 제한</h2><p className="muted">상문마스터는 상문고등학교 1학년 1반 전용입니다. 담당자가 실제 반을 확인하고 승인한 계정만 이용할 수 있어요. 다른 반 학생은 이용할 수 없습니다.</p></section> : <>
      <div className="toolbar"><input className="input" aria-label="조회 날짜" type="date" value={date} onChange={e=>setDate(e.target.value)}/><button className="btn" onClick={load}><RefreshCw size={15} style={{verticalAlign:"middle",marginRight:6}}/>새로고침</button><button className="btn alt" onClick={()=>setShowTask(!showTask)} disabled={!authUser || !isApprovedTargetClass}>＋ 수행평가 등록</button></div>
      {error && <p className="error">데이터 연결 안내: {error}<br/>NEIS 키와 학교 코드 설정을 확인하세요.</p>}
      <div className="grid">
        <section className="card"><div className="row"><h2><Utensils size={19} style={{verticalAlign:"middle",marginRight:7}}/>오늘의 급식</h2><span className="muted">{date}</span></div>
          {loading?<p className="muted">불러오는 중…</p>:meals.length?meals.map((m,i)=><div key={i} className="mealmenu"><b>{m.MMEAL_SC_NM||"급식"}</b>{"\n"}{(m.DDISH_NM||"").replace(/<br\\s*\\/?\\s*>/gi,"\n").replace(/\([^)]*\)/g,"").trim()}{"\n"}<span className="muted">{m.CAL_INFO||""}</span></div>):<div className="mealmenu">급식 정보가 표시됩니다.<br/><span className="muted">NEIS 인증키와 학교코드 설정 후 자동 조회됩니다.</span></div>}
        </section>
        <section className="card"><h2><CalendarDays size={19} style={{verticalAlign:"middle",marginRight:7}}/>다가오는 학사일정</h2><p className="muted">NEIS 공식 학사일정 데이터</p>
          {upcoming.length?upcoming.map((e,i)=><div className="event" key={i}><b>{e.EVENT_NM||"학교 일정"}</b><small>{pretty(e.AA_YMD)} · {e.EVENT_CNTNT||e.SBTR_DD_SC_NM||""}</small></div>):<p className="muted">표시할 일정이 없거나 API 연결을 확인해야 합니다.</p>}
        </section>
        <section className="card wide"><div className="row"><h2><ClipboardList size={19} style={{verticalAlign:"middle",marginRight:7}}/>반별 수행평가 공지</h2><div className="row"><button className="btn alt" onClick={enableReminders}>마감 알림 켜기</button><button className="btn" onClick={()=>setShowTask(!showTask)} disabled={!authUser || !profile?.class_verified}>＋ 공지 등록</button></div></div>
          {!authUser ? <p className="muted">로그인하면 본인 반의 수행평가 공지를 확인할 수 있어요.</p> : !profile ? <p className="muted">학생 프로필을 확인하고 있어요…</p> : !profile.class_verified ? <div className="auth-notice"><b>학년·반 확인 대기 중</b><p className="muted">현재 계정의 학년·반이 확인되면 해당 반 공지를 볼 수 있고, 직접 공지도 등록할 수 있어요. 담당자가 확인한 뒤 이용할 수 있습니다.</p></div> : <p className="muted">공개 범위: 상문고등학교 1학년 1반 · 승인된 우리 반 계정에만 표시됩니다.</p>}
          {showTask && authUser && profile?.class_verified && <form className="form" onSubmit={addTask}><div className="auth-selects"><label>대상 학년<input value={`${profile.grade}학년`} readOnly /></label><label>대상 반<input value={`${profile.class_no}반`} readOnly /></label></div><label>과목<input required maxLength={40} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="예: 공통수학"/></label><label>수행평가 제목<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="예: 탐구 보고서 제출"/></label><label>마감일<input type="date" min={dateNow()} value={due} onChange={e=>setDue(e.target.value)}/></label><label>내용 / 준비물<textarea maxLength={5000} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="평가 범위, 준비물, 제출 방법 등을 적어 주세요."/></label><div className="row"><button className="btn">{editingNoticeId ? "공지 수정 저장" : "우리 반에 공지 등록"}</button>{editingNoticeId && <button type="button" className="btn alt" onClick={()=>{setEditingNoticeId(null);setTitle("");setSubject("");setDesc("");setDue("");setShowTask(false);}}>수정 취소</button>}</div><p className="muted">승인된 1학년 1반 학생만 이 게시판에 공지를 등록할 수 있어요.</p></form>}
          {noticeError && <p className="error" role="alert">{noticeError}</p>}
          {noticeLoading ? <p className="muted">반별 공지를 불러오는 중…</p> : notices.length ? notices.map(n=><div className="notice" key={n.id}><div className="row"><span className="pill">{n.subject}</span><span className="muted">{n.grade}학년 {n.class_no}반</span></div><b>{n.title}</b><p style={{whiteSpace:"pre-wrap"}}>{n.description || "상세 내용 없음"}</p><p className="muted">{n.due_date ? `마감일: ${n.due_date}` : "마감일 미정"} · 등록일 {new Date(n.created_at).toLocaleDateString("ko-KR")}</p>{authUser?.id === n.created_by && <div className="row notice-actions"><button className="btn alt" type="button" onClick={()=>startEditNotice(n)}>수정</button><button className="btn alt danger" type="button" onClick={()=>deleteNotice(n)}>삭제</button></div>}</div>) : authUser && profile?.class_verified ? <p className="muted">아직 등록된 수행평가 공지가 없어요.</p> : null}
          <p className="muted">마감 알림은 브라우저 알림을 허용하고 사이트를 열어 둔 상태에서 확인됩니다. 사이트를 닫은 동안에도 도착하는 푸시 알림은 별도 서버 설정이 필요해요.</p>
        </section>
        <section className="card"><h2><CalendarDays size={19} style={{verticalAlign:"middle",marginRight:7}}/>오늘의 시간표</h2><p className="muted">NEIS 고등학교 시간표 · 1학년 1반</p>{timetable.length ? [...timetable].sort((a,b)=>Number(a.PERIO||0)-Number(b.PERIO||0)).map((t,i)=><div className="event" key={`${t.PERIO}-${i}`}><b>{t.PERIO ? `${t.PERIO}교시` : "수업"} · {t.ITRT_CNTNT || "과목 정보 없음"}</b></div>) : <p className="muted">{timetableMessage || "선택한 날짜의 시간표가 없거나 NEIS 설정 확인이 필요합니다."}</p>}</section>
        <section className="card"><h2><Bell size={19} style={{verticalAlign:"middle",marginRight:7}}/>알림 · 시험 준비</h2><p className="muted">반별 수행평가 마감일을 확인하고, 게시판에서 브라우저 알림을 켤 수 있어요.</p><div className="event"><b>회원가입 / 로그인</b><small>Supabase Auth 연결 필요</small></div><div className="event"><b>학년·반별 시간표</b><small>NEIS 시간표 API 연결 후 조회 가능</small></div><div className="event"><b>마감 임박 알림</b><small>브라우저 알림 허용 및 사이트가 열린 상태에서 작동</small></div></section>
        <section className="card wide"><h2>학교 설정 확인</h2><p className="muted">공식 NEIS 검색 결과를 확인한 뒤 .env.local에 학교 코드를 입력해야 합니다.</p>{school?<div className="event"><b>{school.SCHUL_NM}</b><small>교육청 코드: {school.ATPT_OFCDC_SC_CODE} · 학교 코드: {school.SD_SCHUL_CODE} · {school.ORG_RDNMA||""}</small></div>:<p className="muted">학교 검색 결과가 아직 없습니다. NEIS_API_KEY를 설정하고 서버를 재시작하세요.</p>}</section>
      </div>
      <p className="muted" style={{marginTop:18}}>데이터 출처: NEIS 교육정보 개방 포털. 공공 데이터는 수정·지연될 수 있으므로 중요한 시험 일정은 학교 공식 공지도 함께 확인하세요.</p>
      </>}
    </main>
  </>;
}
