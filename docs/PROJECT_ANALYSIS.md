# 🎯 AI Inbox Solution - 프로젝트 분석 리포트

**생성일**: 2024년  
**업데이트**: Prisma → Firebase 마이그레이션 완료  
**분석 범위**: 전체 프로젝트 구조, 기능 구현 상태, 누락 사항, 개선 필요 사항

---

## 📊 1. 현재 구현 상태 요약

### ✅ 완료된 부분 (약 90-95%)

#### 1.1 인프라 & 설정
- ✅ Next.js 14 App Router 구조
- ✅ TypeScript 설정 (strict mode)
- ✅ Tailwind CSS + 기본 UI 컴포넌트
- ✅ **Firebase Firestore** (User, Email, Rule, Task, CalendarToken 컬렉션)
- ✅ NextAuth.js v5 + Firebase 어댑터 설정
- ✅ 기본 에러 핸들링 (error.tsx, not-found.tsx)

#### 1.2 백엔드 API
- ✅ `/api/emails` - 이메일 목록 조회 (필터링, 페이지네이션)
- ✅ `/api/emails/fetch` - Gmail에서 이메일 가져오기
- ✅ `/api/emails/[id]/classify` - AI 이메일 분류
- ✅ `/api/emails/[id]/summarize` - AI 이메일 요약
- ✅ `/api/emails/[id]/extract-schedule` - 일정 추출
- ✅ `/api/rules` - 규칙 CRUD
- ✅ `/api/rules/[id]` - 규칙 업데이트/삭제
- ✅ `/api/tasks` - 작업 CRUD
- ✅ `/api/tasks/[id]` - 작업 업데이트/삭제
- ✅ `/api/calendar/create-event` - 캘린더 이벤트 생성
- ✅ `/api/calendar/events` - 캘린더 이벤트 조회
- ✅ `/api/cron/sync-emails` - Vercel Cron Job (Gmail 자동 동기화)
- ✅ `/api/auth/[...nextauth]` - NextAuth 핸들러

#### 1.3 AI Agent Tools
- ✅ `classifyEmailTool` - 이메일 분류
- ✅ `extractScheduleFromEmailTool` - 일정 추출
- ✅ `parseRuleFromNaturalLanguageTool` - 자연어 규칙 파싱
- ✅ `applyRulesToEmailTool` - 규칙 적용
- ✅ `summarizeEmailTool` - 요약 생성
- ✅ `createTaskFromEmailTool` - 작업 생성

#### 1.4 프론트엔드 페이지
- ✅ `/inbox` - 이메일 리스트 + 상세 (검색, 필터링 포함)
- ✅ `/today` - Today 대시보드
- ✅ `/tasks` - 작업 관리 (할 일/진행 중/완료)
- ✅ `/rules` - 규칙 관리 (생성, 활성화/비활성화, 삭제)
- ✅ `/calendar` - 캘린더 페이지 (월간 뷰)
- ✅ `/settings` - 설정 페이지 (연동 상태 표시)
- ✅ `/auth/signin` - 로그인 페이지

#### 1.5 통합
- ✅ Gmail API 연동 (`lib/gmail.ts`)
- ✅ Google Calendar API 연동 (`lib/calendar.ts`)
- ✅ OpenAI API 연동 (`lib/openai.ts`)
- ✅ Firebase Firestore 연동 (`lib/firebase.ts`)

#### 1.6 보안 & 검증
- ✅ Zod 기반 API 입력 검증
- ✅ 사용자 인증 검증 강화 (userId 스코프 강제)
- ✅ 공통 에러 핸들러 (`withErrorHandler`)
- ✅ 표준 에러 응답 형식

#### 1.7 UX 개선
- ✅ Toast 알림 시스템
- ✅ 로딩 상태 표시
- ✅ 이메일 필터링/검색 UI
- ✅ 규칙 관리 UI 개선

---

## ❌ 누락된 부분 & 개선 필요 사항

### 🔴 Critical (즉시 해결 필요)

#### 1. Firebase 설정
- **현재 상태**: Firebase Admin SDK 설정 파일 생성됨
- **문제**: Firebase 프로젝트 설정 및 서비스 계정 키 필요
- **해결**: 
  - Firebase Console에서 프로젝트 생성
  - 서비스 계정 키 생성 및 `.env`에 `FIREBASE_SERVICE_ACCOUNT_KEY` 설정
  - 또는 `FIREBASE_PROJECT_ID` 설정 (Application Default Credentials 사용 시)

#### 2. Firestore 인덱스 설정
- **현재 상태**: 복합 쿼리 사용 시 인덱스 필요
- **문제**: Firestore는 복합 쿼리 시 인덱스가 필요함
- **필요 작업**:
  - Firestore Console에서 필요한 인덱스 생성
  - 예: `emails` 컬렉션의 `userId + category`, `userId + priorityLabel` 등

### 🟡 High Priority (우선 구현)

#### 3. Firestore 보안 규칙
- **누락**: Firestore 보안 규칙 설정
- **필요**: 사용자별 데이터 접근 제어
- **권장**: Firebase Console에서 보안 규칙 설정

#### 4. Calendar 페이지 기능 확장
- **현재 상태**: 월간 뷰만 구현됨
- **필요 기능**:
  - 주간/일간 뷰
  - 이메일에서 추출한 일정 표시
  - 일정 클릭 시 상세 정보

#### 5. Settings 페이지 기능 확장
- **현재 상태**: 기본 연동 상태만 표시
- **필요 기능**:
  - OAuth 토큰 만료/갱신 상태
  - API 키 설정 (OpenAI)
  - 동기화 설정

### 🟢 Medium Priority (기능 개선)

#### 6. 성능 최적화
- **필요**: Firestore 쿼리 최적화
- **권장**: 
  - 페이지네이션 개선
  - 캐싱 전략
  - 배치 읽기/쓰기

#### 7. 반응형 디자인 개선
- **현재 상태**: 기본 반응형만 적용
- **필요**: 모바일 최적화, 태블릿 레이아웃

#### 8. 이메일 본문 HTML 렌더링
- **현재 상태**: 텍스트만 표시
- **필요**: HTML 이메일 렌더링 (sanitized)

### 🔵 Low Priority (향후 개선)

#### 9. 테스트 코드
- **누락**: 단위 테스트, 통합 테스트
- **권장**: Jest + React Testing Library

#### 10. 다국어 지원
- **현재 상태**: 한국어만 지원
- **향후**: i18n 추가

---

## 📁 데이터베이스 구조 (Firestore)

### 컬렉션 구조

```
users/
  {userId}/
    - id: string
    - email: string
    - name?: string
    - image?: string
    - emailVerified?: Date
    - createdAt: Timestamp
    - updatedAt: Timestamp

accounts/
  {accountId}/
    - id: string
    - userId: string
    - type: string
    - provider: string
    - providerAccountId: string
    - access_token?: string
    - refresh_token?: string
    - expires_at?: number
    - token_type?: string
    - scope?: string
    - id_token?: string
    - session_state?: string
    - createdAt: Timestamp
    - updatedAt: Timestamp

sessions/
  {sessionId}/
    - id: string
    - sessionToken: string
    - userId: string
    - expires: Date
    - createdAt: Timestamp
    - updatedAt: Timestamp

verificationTokens/
  {tokenId}/
    - identifier: string
    - token: string
    - expires: Date
    - createdAt: Timestamp

emails/
  {emailId}/
    - id: string
    - userId: string
    - channel: string
    - externalId: string
    - threadId?: string
    - from: string
    - to: string
    - cc?: string
    - bcc?: string
    - subject: string
    - bodySnippet?: string
    - bodyFullText?: string
    - receivedAt: Date
    - isRead: boolean
    - isStarred: boolean
    - category?: string
    - priorityScore?: number
    - priorityLabel?: string
    - spamScore?: number
    - isSpam: boolean
    - summary?: string
    - calendarEventId?: string
    - createdAt: Timestamp
    - updatedAt: Timestamp

inboxRules/
  {ruleId}/
    - id: string
    - userId: string
    - name: string
    - description?: string
    - conditions: JSON (RuleCondition[])
    - actions: JSON (RuleAction[])
    - isActive: boolean
    - createdAt: Timestamp
    - updatedAt: Timestamp

tasks/
  {taskId}/
    - id: string
    - userId: string
    - emailId?: string
    - title: string
    - description?: string
    - status: string (TODO, IN_PROGRESS, DONE)
    - dueAt?: Date
    - createdAt: Timestamp
    - updatedAt: Timestamp

calendarTokens/
  {tokenId}/
    - id: string
    - userId: string
    - provider: string
    - accessToken: string
    - refreshToken: string
    - expiresAt: Date
    - createdAt: Timestamp
    - updatedAt: Timestamp
```

### 필요한 Firestore 인덱스

1. **emails 컬렉션**:
   - `userId` + `category` (ascending)
   - `userId` + `priorityLabel` (ascending)
   - `userId` + `isSpam` (ascending)
   - `userId` + `receivedAt` (descending)
   - `userId` + `externalId` (ascending)

2. **inboxRules 컬렉션**:
   - `userId` + `isActive` (ascending)
   - `userId` + `createdAt` (descending)

3. **tasks 컬렉션**:
   - `userId` + `status` (ascending)
   - `userId` + `dueAt` (ascending)

4. **accounts 컬렉션**:
   - `userId` + `provider` (ascending)
   - `provider` + `providerAccountId` (ascending)

---

## 🏗️ 구조적 변경 사항

### Prisma → Firebase 마이그레이션

#### 변경된 파일
- ✅ `lib/prisma.ts` → `lib/firebase.ts` (Firestore 클라이언트)
- ✅ `lib/firebase-adapter.ts` (NextAuth Firebase 어댑터)
- ✅ `auth.ts` (PrismaAdapter → FirebaseAdapter)
- ✅ 모든 API 라우트 (Prisma 쿼리 → Firestore 쿼리)
- ✅ 모든 라이브러리 파일 (Gmail, Calendar, Agent Tools)

#### 주요 변경 사항
1. **데이터베이스 접근 방식**:
   - Prisma ORM → Firebase Admin SDK
   - SQL 쿼리 → Firestore 쿼리
   - 관계형 데이터베이스 → NoSQL 문서 데이터베이스

2. **인증 어댑터**:
   - `@auth/prisma-adapter` → 커스텀 `FirebaseAdapter`
   - Prisma 스키마 → Firestore 컬렉션 구조

3. **쿼리 패턴**:
   - `prisma.model.findMany()` → `db.collection().where().get()`
   - `prisma.model.create()` → `db.collection().add()`
   - `prisma.model.update()` → `db.collection().doc().update()`
   - `prisma.model.delete()` → `db.collection().doc().delete()`

---

## 🚀 개발 우선순위 로드맵

### Phase 1: Firebase 설정 (즉시)
1. ✅ Firebase 프로젝트 생성
2. ✅ 서비스 계정 키 생성
3. ✅ 환경 변수 설정
4. ⏳ Firestore 인덱스 생성
5. ⏳ Firestore 보안 규칙 설정

### Phase 2: 기능 개선 (1-2일)
6. ✅ Calendar 페이지 기능 확장
7. ✅ Settings 페이지 기능 확장
8. ✅ 성능 최적화

### Phase 3: UX 개선 (1-2일)
9. ✅ 반응형 디자인 개선
10. ✅ HTML 이메일 렌더링
11. ✅ 로딩 상태 & 스켈레톤 UI

### Phase 4: 문서화 (완료)
12. ✅ 모든 문서 작성 (`/docs` 폴더)
13. ✅ API 문서화
14. ✅ 배포 가이드

### Phase 5: Polish (1-2일)
15. ⏳ 테스트 코드 작성
16. ⏳ 성능 최적화
17. ⏳ 보안 검토

---

## 📝 다음 단계

**즉시 시작할 작업:**

1. **Firebase 프로젝트 설정** (가장 우선)
   - Firebase Console에서 프로젝트 생성
   - 서비스 계정 키 생성
   - `.env` 파일에 `FIREBASE_SERVICE_ACCOUNT_KEY` 또는 `FIREBASE_PROJECT_ID` 설정

2. **Firestore 인덱스 생성**
   - Firebase Console에서 필요한 인덱스 생성
   - 복합 쿼리 사용 시 필수

3. **Firestore 보안 규칙 설정**
   - 사용자별 데이터 접근 제어
   - 프로덕션 환경에서 필수

이 순서대로 진행하면 프로덕션 준비가 완료됩니다.

---

## 🔧 환경 변수 설정

### 필수 환경 변수

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=your-auth-secret-here

# Firebase
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}  # JSON 문자열 또는 파일 경로

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Vercel Cron
CRON_SECRET=your-cron-secret-here
```

---

**분석 완료일**: 2024년  
**마이그레이션 완료일**: 2024년 (Prisma → Firebase)  
**다음 리뷰**: Firebase 설정 완료 후
