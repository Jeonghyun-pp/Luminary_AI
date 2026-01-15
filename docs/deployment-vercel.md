# Vercel 배포 가이드

AI Inbox Solution을 Vercel에 배포하는 완전한 가이드입니다.

## 사전 준비

### 1. GitHub 저장소 준비

1. GitHub에 새 저장소 생성
2. 로컬 프로젝트를 Git 저장소로 초기화:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/inbox-solution.git
   git push -u origin main
   ```

### 2. 데이터베이스 설정

**Neon 사용 (권장):**
1. [Neon](https://neon.tech) 접속
2. 무료 계정 생성
3. 새 프로젝트 생성
4. 연결 문자열 복사

**Supabase 사용:**
1. [Supabase](https://supabase.com) 접속
2. 무료 계정 생성
3. 새 프로젝트 생성
4. Settings > Database > Connection string 복사

---

## Vercel 배포 단계

### 1. Vercel 프로젝트 생성

1. [Vercel](https://vercel.com) 접속
2. "Add New..." > "Project" 클릭
3. GitHub 저장소 선택
4. 프로젝트 설정:
   - Framework Preset: Next.js
   - Root Directory: `./` (기본값)
   - Build Command: `npm run build` (기본값)
   - Output Directory: `.next` (기본값)
   - Install Command: `npm install` (기본값)

### 2. 환경 변수 설정

Vercel 대시보드에서 다음 환경 변수들을 추가:

**필수 변수:**
```
NEXTAUTH_URL=https://your-project.vercel.app
AUTH_SECRET=<생성한-시크릿-키>
DATABASE_URL=<데이터베이스-연결-문자열>
OPENAI_API_KEY=<openai-api-key>
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
```

**선택 변수:**
```
NEXTAUTH_SECRET=<nextauth-secret> (v4 호환성)
GOOGLE_API_KEY=<google-api-key> (선택사항)
CRON_SECRET=<cron-secret> (Cron Job 보안용)
```

**설정 방법:**
1. 프로젝트 > Settings > Environment Variables
2. 각 변수 추가:
   - Key: 변수 이름
   - Value: 실제 값
   - Environment: Production, Preview, Development 모두 선택

### 3. 데이터베이스 마이그레이션

배포 후 데이터베이스 스키마를 적용:

**옵션 1: Vercel CLI 사용**
```bash
npm i -g vercel
vercel login
vercel link
npm run db:push
```

**옵션 2: 로컬에서 실행**
```bash
# .env에 프로덕션 DATABASE_URL 설정
DATABASE_URL=<프로덕션-데이터베이스-URL>
npm run db:push
```

### 4. 배포 확인

1. Vercel 대시보드에서 배포 상태 확인
2. 배포된 URL 접속: `https://your-project.vercel.app`
3. 로그인 테스트
4. 기능 테스트

---

## Vercel Cron Job 설정

### 방법 1: vercel.json 사용 (권장)

프로젝트 루트의 `vercel.json` 파일이 이미 설정되어 있습니다:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-emails",
      "schedule": "0 * * * *"
    }
  ]
}
```

이 설정은 자동으로 Vercel에 적용됩니다.

### 방법 2: Vercel 대시보드에서 설정

1. 프로젝트 > Settings > Cron Jobs
2. "Add Cron Job" 클릭
3. 설정:
   - Path: `/api/cron/sync-emails`
   - Schedule: `0 * * * *` (매시간)
   - Timezone: `Asia/Seoul` (선택사항)

### Cron Schedule 예시

- `0 * * * *` - 매시간
- `0 */6 * * *` - 6시간마다
- `0 9 * * *` - 매일 오전 9시
- `*/30 * * * *` - 30분마다

### Cron Secret 설정

보안을 위해 Cron Job에 시크릿 추가:

1. 환경 변수에 `CRON_SECRET` 추가
2. `/api/cron/sync-emails/route.ts`에서 검증 (이미 구현됨)

---

## Google OAuth 프로덕션 설정

### 1. OAuth 동의 화면 게시

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. "API 및 서비스" > "OAuth 동의 화면"
3. "게시" 버튼 클릭
4. Google 검토 프로세스 진행 (필요시)

### 2. 승인된 리디렉션 URI 추가

1. "사용자 인증 정보" > OAuth 클라이언트 ID 편집
2. 승인된 리디렉션 URI에 추가:
   ```
   https://your-project.vercel.app/api/auth/callback/google
   ```
3. 저장

### 3. API 활성화 확인

- Gmail API: 활성화됨
- Google Calendar API: 활성화됨

---

## 도메인 연결 (선택사항)

### 커스텀 도메인 추가

1. Vercel 프로젝트 > Settings > Domains
2. "Add Domain" 클릭
3. 도메인 입력
4. DNS 설정 안내 따르기

**DNS 레코드:**
- Type: `CNAME`
- Name: `@` 또는 `www`
- Value: `cname.vercel-dns.com`

### 환경 변수 업데이트

도메인 연결 후:
```env
NEXTAUTH_URL=https://yourdomain.com
```

---

## 배포 후 확인 사항

### 필수 확인

- [ ] 홈페이지 로드됨
- [ ] Google 로그인 작동
- [ ] 데이터베이스 연결 확인
- [ ] 이메일 가져오기 작동
- [ ] AI 분류 작동
- [ ] 규칙 생성 작동
- [ ] 캘린더 연동 작동

### 성능 확인

- [ ] 페이지 로딩 속도
- [ ] API 응답 시간
- [ ] 데이터베이스 쿼리 성능

### 보안 확인

- [ ] HTTPS 사용 중
- [ ] 환경 변수 노출 없음
- [ ] 인증이 모든 보호된 라우트에서 작동
- [ ] CORS 설정 확인

---

## 문제 해결

### 배포 실패

1. **빌드 로그 확인:**
   - Vercel 대시보드 > Deployments > 실패한 배포 클릭
   - Build Logs 확인

2. **일반적인 원인:**
   - 환경 변수 누락
   - TypeScript 오류
   - 의존성 설치 실패
   - 빌드 타임아웃

### 런타임 오류

1. **Function Logs 확인:**
   - Vercel 대시보드 > 프로젝트 > Functions 탭
   - 실시간 로그 확인

2. **일반적인 원인:**
   - 데이터베이스 연결 실패
   - API 키 오류
   - OAuth 토큰 만료

### Cron Job이 실행되지 않음

1. **Cron Jobs 탭 확인:**
   - Vercel 대시보드 > 프로젝트 > Cron Jobs
   - 실행 이력 확인

2. **확인 사항:**
   - `vercel.json`이 올바른지
   - `CRON_SECRET`이 설정되었는지
   - API 엔드포인트가 올바른지

---

## 모니터링

### Vercel Analytics

1. 프로젝트 > Analytics 탭
2. 성능 메트릭 확인
3. 에러 추적

### 로그 모니터링

1. 프로젝트 > Logs 탭
2. 실시간 로그 확인
3. 에러 필터링

---

## 업데이트 배포

코드 변경 후:

```bash
git add .
git commit -m "Update: ..."
git push origin main
```

Vercel이 자동으로 새 배포를 생성합니다.

---

## 롤백

이전 버전으로 롤백:

1. Vercel 대시보드 > Deployments
2. 이전 배포 선택
3. "Promote to Production" 클릭

---

## 비용 관리

### Vercel 무료 플랜 제한

- 대역폭: 100GB/월
- Function 실행 시간: 100GB-시간/월
- 빌드 시간: 6000분/월

### OpenAI API 비용

- GPT-4o-mini 사용 시 비용 최소화
- 사용량 모니터링 권장
- [OpenAI Usage Dashboard](https://platform.openai.com/usage) 확인

### 데이터베이스 비용

- Neon/Supabase 무료 플랜 사용 가능
- 사용량 증가 시 플랜 업그레이드 고려

---

## 보안 체크리스트

- [ ] 모든 환경 변수가 Vercel에 설정됨
- [ ] `.env` 파일이 Git에 커밋되지 않음
- [ ] `CRON_SECRET`이 설정됨
- [ ] OAuth 리디렉션 URI가 올바름
- [ ] HTTPS 사용 중
- [ ] 데이터베이스 연결이 SSL 사용
- [ ] API 키가 안전하게 관리됨

