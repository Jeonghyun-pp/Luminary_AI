# 환경 변수 설정 가이드

이 문서는 AI Inbox Solution 프로젝트에 필요한 모든 환경 변수를 설명합니다.

## 필수 환경 변수

### 1. NextAuth 설정

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
AUTH_SECRET=your-auth-secret-here
```

**설명:**
- `NEXTAUTH_URL`: 애플리케이션의 기본 URL (프로덕션에서는 실제 도메인)
- `NEXTAUTH_SECRET`: NextAuth v4 호환성을 위한 시크릿 키
- `AUTH_SECRET`: NextAuth v5에서 사용하는 시크릿 키 (필수)

**생성 방법:**
```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

**주의사항:**
- 프로덕션에서는 반드시 강력한 랜덤 문자열 사용
- `.env` 파일은 절대 Git에 커밋하지 않기
- Vercel 배포 시 환경 변수로 설정

---

### 2. Firebase 설정

Firebase 설정은 다음 중 하나의 방법으로 할 수 있습니다 (우선순위 순):

#### 방법 1: 환경 변수에 JSON 문자열로 설정 (권장 - Vercel 배포 시)

```env
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project-id",...}
FIREBASE_PROJECT_ID=your-project-id
```

**설명:**
- `FIREBASE_SERVICE_ACCOUNT_KEY`: Firebase 서비스 계정 키의 전체 JSON을 문자열로 설정
- `FIREBASE_PROJECT_ID`: Firebase 프로젝트 ID

#### 방법 2: 파일 경로로 설정

```env
GOOGLE_APPLICATION_CREDENTIALS=./path/to/firebase-adminsdk-*.json
```

**설명:**
- `GOOGLE_APPLICATION_CREDENTIALS`: Firebase 서비스 계정 키 파일의 경로

#### 방법 3: 프로젝트 루트에 파일 배치 (로컬 개발용)

프로젝트 루트 디렉토리에 `*-firebase-adminsdk-*.json` 파일을 배치하면 자동으로 인식됩니다.

**주의사항:**
- Firebase 서비스 계정 키 파일은 절대 Git에 커밋하지 않기
- `.gitignore`에 이미 추가되어 있음
- 프로덕션에서는 환경 변수 사용 권장
- 로컬 개발 시에는 프로젝트 루트에 파일을 배치하는 방법이 가장 간단

**Firebase 프로젝트 설정:**
1. [Firebase Console](https://console.firebase.google.com/)에서 프로젝트 생성
2. Firestore Database 활성화
3. 프로젝트 설정 > 서비스 계정에서 서비스 계정 키 다운로드
4. 다운로드한 JSON 파일을 프로젝트 루트에 배치하거나 환경 변수로 설정

---

### 3. OpenAI API

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
```

**설명:**
- OpenAI API 키 (GPT-4 모델 사용)
- AI 이메일 분류, 요약, 규칙 파싱 등에 사용

**발급 방법:**
1. [OpenAI Platform](https://platform.openai.com/api-keys) 접속
2. 계정 생성/로그인
3. API Keys 섹션에서 "Create new secret key" 클릭
4. 키 복사 (한 번만 표시되므로 안전하게 보관)

**주의사항:**
- API 키는 비용이 발생하므로 안전하게 관리
- 환경 변수로만 저장, 코드에 하드코딩 금지
- 사용량 모니터링 권장

---

### 4. Google OAuth (인증)

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
```

**설명:**
- Google OAuth 2.0 클라이언트 ID 및 Secret
- 사용자 인증 및 Gmail/Calendar API 접근에 사용

**발급 방법:**
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 생성 또는 선택
3. "API 및 서비스" > "사용자 인증 정보"
4. "OAuth 2.0 클라이언트 ID" 생성
5. 애플리케이션 유형: "웹 애플리케이션"
6. 승인된 리디렉션 URI: `http://localhost:3000/api/auth/callback/google`

**주의사항:**
- 프로덕션 도메인도 리디렉션 URI에 추가 필요
- Client Secret은 안전하게 보관

---

### 5. Google API (선택사항)

```env
GOOGLE_API_KEY=your-google-api-key-here
```

**설명:**
- Google API 키 (일부 고급 기능용)
- 현재 구현에서는 OAuth 토큰을 사용하므로 필수 아님

---

### 6. Vercel Cron (프로덕션)

```env
CRON_SECRET=your-cron-secret-here
```

**설명:**
- Vercel Cron Job이 API를 호출할 때 사용하는 시크릿
- 무단 접근 방지용

**생성 방법:**
- `AUTH_SECRET`과 동일한 방법으로 생성

---

## 환경별 설정

### 개발 환경 (로컬)

`.env` 파일에 모든 변수 설정:

```env
NODE_ENV=development
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=...
DATABASE_URL=...
OPENAI_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### 프로덕션 환경 (Vercel)

Vercel 대시보드에서 환경 변수 설정:

1. 프로젝트 선택
2. Settings > Environment Variables
3. 각 변수 추가:
   - Key: 환경 변수 이름
   - Value: 실제 값
   - Environment: Production, Preview, Development 선택

**프로덕션 필수 변경:**
- `NEXTAUTH_URL`: 실제 도메인 (예: `https://yourdomain.com`)
- `DATABASE_URL`: 프로덕션 데이터베이스 URL
- 모든 시크릿 키: 강력한 랜덤 문자열

---

## 검증 체크리스트

배포 전 확인:

- [ ] 모든 필수 환경 변수 설정됨
- [ ] `AUTH_SECRET`이 강력한 랜덤 문자열
- [ ] `DATABASE_URL`이 올바른 형식
- [ ] `OPENAI_API_KEY`가 유효함
- [ ] `GOOGLE_CLIENT_ID`와 `GOOGLE_CLIENT_SECRET`이 올바름
- [ ] 프로덕션 `NEXTAUTH_URL`이 실제 도메인
- [ ] `.env` 파일이 `.gitignore`에 포함됨
- [ ] Vercel 환경 변수가 모두 설정됨

---

## 문제 해결

### 환경 변수가 로드되지 않음

1. `.env` 파일이 프로젝트 루트에 있는지 확인
2. 서버 재시작 (환경 변수 변경 후 필수)
3. 변수 이름 오타 확인
4. 따옴표나 공백이 없는지 확인

### 데이터베이스 연결 실패

1. `DATABASE_URL` 형식 확인
2. 데이터베이스가 실행 중인지 확인 (로컬)
3. 방화벽 설정 확인 (클라우드)
4. SSL 모드 확인 (클라우드)

### OAuth 오류

1. Google Cloud Console에서 OAuth 클라이언트 확인
2. 리디렉션 URI가 정확한지 확인
3. Gmail API 및 Calendar API 활성화 확인

