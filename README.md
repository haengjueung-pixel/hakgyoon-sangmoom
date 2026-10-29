# 상문마스터 — 상문고등학교 1학년 1반 학교생활 사이트

이 프로젝트는 Next.js + Supabase + NEIS Open API 기반입니다. 아직 배포/실서비스 테스트가 완료된 것은 아니므로 아래 절차대로 연결하고 검증한 뒤 공유하세요.

## 포함 기능
- NEIS 급식, 학사일정, 학교 검색, 고등학교 시간표 API 라우트
- 이메일/비밀번호 회원가입·로그인·로그아웃
- 상문고 1학년 1반 고정 가입 프로필과 담당자 승인 대기
- 승인된 1학년 1반 계정만 반별 수행평가 게시판 접근
- 본인이 등록한 공지 수정·삭제, 마감일 브라우저 알림(사이트가 열려 있을 때)
- 네이버 검색용 metadata, `robots.txt`, `sitemap.xml`, 소유확인 메타 태그 환경변수 지원
- 사이트 문구를 직접 고칠 수 있는 `lib/site-config.ts`

## 1. 준비
- Node.js 20 이상
- NEIS Open API 인증키: https://open.neis.go.kr/portal/mainPage.do
- Supabase 프로젝트: https://supabase.com/
- GitHub 계정 및 Vercel 배포 계정

## 2. 내 PC에서 직접 수정하기
1. ZIP을 압축 해제합니다. 안에 있는 `sangmoon-master` 폴더를 VS Code로 엽니다.
2. `lib/site-config.ts`를 열면 사이트 이름, 학교 이름, 첫 화면 문구를 수정할 수 있습니다.
3. 기능을 수정하려면 `app/page.tsx`, 디자인은 `app/globals.css`, 검색 노출 설정은 `app/layout.tsx`, `app/robots.ts`, `app/sitemap.ts`를 확인하세요.
4. `.env.example`을 복사해 `.env.local`로 이름을 바꾸고 아래 환경변수를 채웁니다. `.env.local`은 GitHub에 올리지 마세요.
5. 터미널에서 `npm install` 후 `npm run dev`를 실행합니다. 브라우저에서 `http://localhost:3000`으로 확인합니다.

## 3. 환경변수 설정
`.env.local`에 다음 값을 설정합니다.

```env
NEIS_API_KEY=발급받은_NEIS_인증키
NEXT_PUBLIC_SUPABASE_URL=https://프로젝트ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=Supabase_공개용_anon_키
SCHOOL_NAME=상문고등학교
SCHOOL_REGION=서울특별시
NEIS_ATPT_OFCDC_SC_CODE=B10
NEIS_SD_SCHUL_CODE=학교검색으로_확인한_학교코드
NEXT_PUBLIC_SITE_URL=https://실제배포주소
NEXT_PUBLIC_NAVER_SITE_VERIFICATION=네이버_소유확인_메타태그_content값
```

- NEIS 학교 코드는 `/api/school-search?name=상문고등학교&region=서울특별시` 응답에서 확인합니다. 인증키는 서버 환경변수 `NEIS_API_KEY`에만 두고 `NEXT_PUBLIC_`을 붙이지 마세요.
- Supabase의 `service_role` 키는 절대 브라우저 코드나 GitHub에 넣지 마세요. 이 프로젝트는 브라우저용 anon/publishable key를 사용합니다.
- `NEXT_PUBLIC_SITE_URL`은 실제 HTTPS 배포 주소를 입력합니다. 주소가 없으면 사이트맵에 URL이 생성되지 않습니다. 환경변수를 바꾼 뒤에는 개발 서버 재시작 또는 재배포가 필요합니다.

## 4. Supabase 설정 및 학생 승인
### 새 Supabase 프로젝트
1. Supabase에서 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase/schema.sql` 전체를 실행합니다.
3. Authentication → URL Configuration에서 로컬 주소와 배포 후 실제 주소를 등록합니다.
4. `.env.local`에 Project URL과 공개용 anon key를 입력합니다.

### 기존 프로젝트
1. 데이터베이스를 백업합니다.
2. `supabase/migrations/20261030_class_assignment_notices.sql`을 SQL Editor에서 실행합니다.
3. 기존 `profiles` 데이터와 정책을 확인합니다. 기존 프로젝트마다 구조가 다를 수 있으므로 SQL 실행 오류가 나면 오류 전문을 확인하고 무작정 재실행하지 마세요.

### 학생 승인
```sql
select id, display_name, grade, class_no, class_verified
from public.profiles
order by created_at desc;
```
실제로 1학년 1반 학생인지 확인한 다음 해당 UUID만 승인합니다.
```sql
update public.profiles
set class_verified = true
where id = '확인한-학생의-UUID' and grade = 1 and class_no = 1;
```
승인하지 않은 계정은 게시판을 사용할 수 없어야 합니다. 실제 학생 정보 확인 없이 일괄 승인하지 마세요.

## 5. NEIS 기능 확인
- `GET /api/school-search?name=상문고등학교&region=서울특별시`
- `GET /api/meals?date=2026-10-30`
- `GET /api/calendar?from=2026-01-01&to=2026-12-31`
- `GET /api/timetable?date=2026-10-30&grade=1&class=1`

NEIS API 인증키 발급 및 학교 코드 설정 후 작동합니다. 실제 데이터가 제공되지 않는 날짜(휴일 등)에는 빈 결과가 나올 수 있습니다.

## 6. 네이버 서치어드바이저 등록
네이버 검색 등록은 공개 배포 주소가 먼저 있어야 합니다. 등록을 대신 완료할 수는 없지만 이 프로젝트에는 필요한 SEO 경로를 넣었습니다.

1. GitHub에 프로젝트를 올리고 Vercel에서 배포합니다.
2. Vercel의 Project → Settings → Environment Variables에 `.env.local`과 같은 환경변수를 추가합니다. `NEXT_PUBLIC_SITE_URL`에는 배포된 HTTPS 주소를 넣습니다.
3. 다시 배포한 뒤 브라우저에서 `https://실제주소/robots.txt`와 `https://실제주소/sitemap.xml`이 열리는지 확인합니다.
4. 네이버 서치어드바이저(https://searchadvisor.naver.com/)에서 로그인하고 사이트 등록에 실제 HTTPS 주소를 입력합니다.
5. 네이버가 제공하는 HTML 메타태그 방식의 `content` 값만 복사해 `NEXT_PUBLIC_NAVER_SITE_VERIFICATION`에 넣고 재배포합니다. 예를 들어 태그가 `<meta name="naver-site-verification" content="abc123" />`라면 `abc123`만 입력합니다.
6. 네이버 서치어드바이저에서 소유 확인을 완료합니다.
7. 요청 메뉴에서 사이트맵 `https://실제주소/sitemap.xml`을 제출하고, 웹페이지 수집/사이트 진단을 확인합니다.

네이버 소유확인 코드는 공개되어도 되는 검증 토큰이지만, NEIS 인증키나 Supabase 비밀키와 혼동하지 마세요. 검색 등록이 곧 검색 결과 노출을 보장하지는 않습니다. 네이버가 사이트를 수집·평가하는 데 시간이 걸릴 수 있습니다.

## 7. 공개 전에 확인할 점
- 이 사이트는 1학년 1반 승인 계정용 기능이 있으므로, 공개 홈페이지에 개인정보·학생 이메일·비공개 공지 내용이 노출되지 않는지 확인하세요.
- `robots.txt`는 `/api/` 수집을 제한하지만 보안 수단은 아닙니다. 데이터 접근은 Supabase RLS가 책임져야 합니다.
- 본인 작성 공지만 수정·삭제하도록 UI와 RLS를 함께 사용합니다.
- 마감 알림은 사이트가 열린 상태에서 브라우저 알림을 허용했을 때 작동합니다. 사이트가 닫혀 있어도 도착하는 푸시 알림은 별도 서비스 워커/푸시 서버가 필요합니다.
- 학교 로고, 학생 개인정보, 학교 명칭을 공개적으로 사용할 권한과 개인정보 처리방침을 확인하세요.
- `npm install`과 `npm run build`를 직접 실행해 빌드 오류를 확인한 뒤 배포하세요. 현재 이 환경에서는 실제 Supabase 프로젝트와 NEIS 키가 없으므로 라이브 연동 검증은 완료되지 않았습니다.

## 공식 문서
- NEIS Open API 개발자 가이드: https://open.neis.go.kr/portal/guide/apiGuidePage.do
- 네이버 robots.txt 가이드: https://searchadvisor.naver.com/guide/seo-basic-robots
- 네이버 SEO 기본 가이드: https://searchadvisor.naver.com/guide/seo-basic-intro
