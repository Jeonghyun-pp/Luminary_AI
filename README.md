# CREA-IT_Project - AI Inbox Solution

AI 기반 이메일 관리 및 통합 일정/작업 관리 시스템

## 주요 기능

- **통합 Inbox**: Gmail 연동으로 모든 이메일을 한 곳에서 관리
- **AI 기반 분류**: 자동으로 이메일을 카테고리별로 분류하고 우선순위 지정
- **자연어 규칙**: 자연어로 규칙을 설명하면 AI가 자동으로 구조화된 규칙으로 변환
- **일정 추출**: 이메일에서 일정 정보를 자동으로 추출하여 Google Calendar에 추가
- **작업 관리**: 이메일 기반 작업 생성 및 관리 (Notion 스타일)
- **Today 뷰**: 오늘 할 일, 우선순위 높은 이메일을 한 화면에서 확인

## 기술 스택

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Firebase Firestore
- **Authentication**: NextAuth.js (Google OAuth)
- **AI/LLM**: OpenAI API (GPT-4)
- **APIs**: Gmail API, Google Calendar API
- **Deployment**: Vercel

## 시작하기

### 1. 환경 변수 설정

`.env` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=your-secret-key-here

# Firebase
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# LLM
OPENAI_API_KEY=your-openai-api-key

# Google OAuth (Auth)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Vercel Cron
CRON_SECRET=your-cron-secret-here
```

### 2. Firebase 설정

1. [Firebase Console](https://console.firebase.google.com/)에서 프로젝트 생성
2. Firestore Database 활성화
3. 서비스 계정 키 생성 및 환경 변수에 설정
4. `users/{uid}` 하위에 `inbox`, `tasks`, `rules`, `favorites` 등이 생성될 수 있도록 보안 규칙/인덱스 구성 (자세한 내용은 `docs/firebase-setup.md` 참고)

### 2-1. 기존 Firestore 데이터 마이그레이션 (선택)

이전 버전에서 상위 컬렉션(`emails`, `tasks`, `inboxRules`)을 사용했다면 다음 스크립트로 사용자별 서브컬렉션 구조로 이전할 수 있습니다.

```bash
npx tsx scripts/migrate-user-data.ts
```

환경 변수 `DELETE_LEGACY_COLLECTIONS=true` 를 추가하면 복사 후 기존 컬렉션 문서를 삭제합니다. 첫 실행 시에는 삭제 옵션 없이 백업을 유지하는 것을 권장합니다.

### 3. 의존성 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## Google OAuth 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
2. OAuth 2.0 클라이언트 ID 생성
3. 승인된 리디렉션 URI에 `http://localhost:3000/api/auth/callback/google` 추가
4. Gmail API 및 Calendar API 활성화
5. 클라이언트 ID와 시크릿을 환경 변수에 설정

자세한 설정 방법은 `docs/GOOGLE_OAUTH_SETUP.md`를 참고하세요.

## 프로젝트 구조

```
.
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   ├── inbox/             # Inbox 페이지
│   ├── rules/             # 규칙 관리 페이지
│   ├── tasks/             # 작업 관리 페이지
│   └── today/             # Today 대시보드
├── components/            # React 컴포넌트
│   ├── ui/               # UI 컴포넌트 (shadcn/ui 스타일)
│   ├── sidebar.tsx       # 사이드바
│   ├── email-list.tsx    # 이메일 리스트
│   └── email-detail.tsx  # 이메일 상세
├── lib/                   # 유틸리티 및 라이브러리
│   ├── agent/            # AI 에이전트 툴
│   ├── firebase.ts       # Firebase Firestore 클라이언트
│   ├── firebase-adapter.ts # NextAuth Firebase 어댑터
│   ├── gmail.ts          # Gmail API 연동
│   ├── calendar.ts       # Calendar API 연동
│   └── openai.ts         # OpenAI 클라이언트
├── docs/                  # 문서
└── types/                 # TypeScript 타입 정의
```

## 주요 기능 설명

### AI 에이전트

AI 에이전트는 다음 툴들을 제공합니다:

- `classifyEmail`: 이메일 분류 및 우선순위 지정
- `extractScheduleFromEmail`: 이메일에서 일정 정보 추출
- `parseRuleFromNaturalLanguage`: 자연어 규칙을 구조화된 규칙으로 변환
- `applyRulesToEmail`: 활성화된 규칙을 이메일에 적용
- `summarizeEmail`: 이메일 요약 생성
- `createTaskFromEmail`: 이메일에서 작업 생성

자세한 내용은 `docs/agent-tools.md`를 참고하세요.

### 규칙 시스템

자연어로 규칙을 설명하면 AI가 자동으로 구조화된 규칙으로 변환합니다.

예시:
- "인보이스, 청구, 결제 관련 메일은 모두 WORK/FINANCE로 분류하고, 우선순위를 높음으로 설정해줘."
- "뉴스레터나 광고 메일은 PROMOTION으로 분류하고, 우선순위는 낮음으로 해줘."

## 배포

Vercel에 배포하려면:

1. GitHub에 프로젝트 푸시
2. Vercel에서 프로젝트 import
3. 환경 변수 설정
4. Firebase 프로젝트 연결
5. 배포 완료!

자세한 배포 가이드는 `docs/deployment-vercel.md`를 참고하세요.

## 문서

- [환경 변수 설정 가이드](docs/env-variables.md)
- [Firebase 설정 가이드](docs/PROJECT_ANALYSIS.md)
- [Google OAuth 설정](docs/GOOGLE_OAUTH_SETUP.md)
- [Gmail API 설정](docs/gmail-api-setup.md)
- [Google Calendar 설정](docs/google-calendar-setup.md)
- [시스템 아키텍처](docs/system-architecture.md)
- [AI 에이전트 툴](docs/agent-tools.md)
- [배포 가이드](docs/deployment-vercel.md)

## 라이선스

MIT
