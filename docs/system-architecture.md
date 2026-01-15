# 시스템 아키텍처

AI Inbox Solution의 전체 시스템 아키텍처 및 설계 문서입니다.

## 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser)                      │
│  Next.js App Router (React, TypeScript, Tailwind CSS)       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTTP/HTTPS
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                    Vercel Edge Network                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Next.js Server (Node.js)                │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │   │
│  │  │   API Routes │  │   Middleware │  │   Pages   │ │   │
│  │  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │   │
│  └─────────┼──────────────────┼─────────────────┼───────┘   │
└────────────┼──────────────────┼─────────────────┼───────────┘
             │                  │                 │
    ┌────────┴────────┐  ┌──────┴──────┐  ┌──────┴──────┐
    │                 │  │             │  │             │
┌───▼────┐    ┌──────▼───▼──┐  ┌──────▼───▼──┐  ┌──────▼──────┐
│PostgreSQL│  │  Gmail API  │  │Calendar API │  │ OpenAI API  │
│ (Prisma) │  │             │  │             │  │             │
└──────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

## 레이어 구조

### 1. 프레젠테이션 레이어 (Frontend)

**기술 스택:**
- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui 컴포넌트

**주요 페이지:**
- `/inbox` - 이메일 목록 및 상세
- `/today` - Today 대시보드
- `/tasks` - 작업 관리
- `/calendar` - 캘린더 뷰
- `/rules` - 규칙 관리
- `/settings` - 설정

**특징:**
- Server Components와 Client Components 혼합
- 실시간 상태 관리 (React Hooks)
- Toast 알림 시스템
- 반응형 디자인

---

### 2. API 레이어 (Backend)

**구조:**
```
app/api/
├── auth/[...nextauth]/route.ts    # NextAuth 핸들러
├── emails/
│   ├── route.ts                   # 이메일 목록 조회
│   ├── fetch/route.ts             # Gmail에서 가져오기
│   └── [id]/
│       ├── classify/route.ts      # AI 분류
│       ├── summarize/route.ts     # AI 요약
│       └── extract-schedule/route.ts  # 일정 추출
├── rules/
│   ├── route.ts                   # 규칙 CRUD
│   └── [id]/route.ts              # 규칙 업데이트/삭제
├── tasks/
│   ├── route.ts                   # 작업 CRUD
│   └── [id]/route.ts              # 작업 업데이트/삭제
├── calendar/
│   ├── events/route.ts            # 캘린더 이벤트 조회
│   └── create-event/route.ts      # 이벤트 생성
└── cron/
    └── sync-emails/route.ts       # 자동 동기화
```

**특징:**
- RESTful API 설계
- Zod를 통한 입력 검증
- 표준화된 에러 처리
- 사용자 인증 및 권한 검증

---

### 3. 비즈니스 로직 레이어

**AI Agent Tools:**
```
lib/agent/
├── tools.ts                       # 툴 정의 및 등록
├── classify.ts                    # 이메일 분류
├── summarize.ts                   # 이메일 요약
├── extract-schedule.ts            # 일정 추출
├── parse-rule.ts                  # 자연어 규칙 파싱
├── apply-rules.ts                 # 규칙 적용
└── create-task.ts                 # 작업 생성
```

**서비스 레이어:**
```
lib/
├── gmail.ts                       # Gmail API 연동
├── calendar.ts                    # Calendar API 연동
├── openai.ts                      # OpenAI 클라이언트
├── prisma.ts                      # Prisma 클라이언트
├── auth.ts                        # 인증 유틸리티
└── errors/handler.ts              # 에러 핸들링
```

---

### 4. 데이터 레이어

**Prisma Schema:**
```
prisma/schema.prisma
├── User                          # 사용자
├── Account                       # OAuth 계정
├── Session                       # 세션
├── Email                         # 이메일
├── InboxRule                     # 규칙
├── Task                          # 작업
└── CalendarToken                 # 캘린더 토큰
```

**데이터베이스:**
- PostgreSQL (로컬 또는 클라우드)
- Prisma ORM 사용
- 마이그레이션 기반 스키마 관리

---

## 데이터 흐름

### 이메일 동기화 플로우

```
1. 사용자 클릭 또는 Cron Job 트리거
   ↓
2. /api/emails/fetch 호출
   ↓
3. getGmailClient() - OAuth 토큰 가져오기
   ↓
4. fetchGmailEmails() - Gmail API 호출
   ↓
5. 이메일 데이터 파싱 및 저장 (Prisma)
   ↓
6. applyRulesToEmailTool() - 규칙 자동 적용
   ↓
7. 응답 반환
```

### AI 분류 플로우

```
1. 사용자 "분류하기" 버튼 클릭
   ↓
2. /api/emails/[id]/classify 호출
   ↓
3. classifyEmailTool() 실행
   ↓
4. OpenAI API 호출 (GPT-4o-mini)
   ↓
5. JSON 응답 파싱 (category, priority, spam)
   ↓
6. Prisma로 이메일 업데이트
   ↓
7. 클라이언트에 결과 반환
```

### 규칙 적용 플로우

```
1. 새 이메일 저장 또는 수동 적용
   ↓
2. applyRulesToEmailTool() 호출
   ↓
3. 활성화된 규칙 조회 (Prisma)
   ↓
4. 각 규칙의 조건 평가
   ↓
5. 조건 일치 시 액션 실행
   (SET_CATEGORY, SET_PRIORITY, MARK_SPAM 등)
   ↓
6. 이메일 업데이트 (Prisma)
```

---

## 보안 아키텍처

### 인증 및 인가

1. **NextAuth.js v5:**
   - Google OAuth 2.0
   - JWT 기반 세션
   - PrismaAdapter로 세션 저장

2. **미들웨어:**
   - Edge Runtime에서 실행
   - 공개/보호 라우트 구분
   - 인증되지 않은 요청 리디렉션

3. **API 보안:**
   - 모든 API에서 `getCurrentUser()` 호출
   - userId 스코프 강제 검증
   - 리소스 소유권 확인

### 데이터 보안

- 환경 변수로 모든 시크릿 관리
- 데이터베이스 연결 SSL 사용
- OAuth 토큰 암호화 저장
- 입력 검증 (Zod)

---

## 성능 최적화

### 프론트엔드

- Server Components 사용
- 이미지 최적화 (Next.js Image)
- 코드 스플리팅
- 클라이언트 사이드 캐싱

### 백엔드

- 데이터베이스 인덱싱
- 쿼리 최적화
- API 응답 캐싱 (필요시)
- 배치 처리 (이메일 동기화)

### AI 호출

- GPT-4o-mini 사용 (비용 효율)
- 응답 형식 지정 (JSON mode)
- 온도 설정 최적화
- 에러 재시도 로직

---

## 확장성 고려사항

### 수평 확장

- Vercel Edge Network 활용
- Stateless API 설계
- 데이터베이스 연결 풀링

### 수직 확장

- 데이터베이스 인덱스 최적화
- 쿼리 성능 튜닝
- 캐싱 전략 도입

### 비용 최적화

- OpenAI API 사용량 모니터링
- 불필요한 AI 호출 최소화
- 데이터베이스 쿼리 최적화

---

## 모니터링 및 로깅

### 로깅

- Vercel Function Logs
- 콘솔 로그 (개발 환경)
- 에러 추적 (프로덕션)

### 모니터링

- Vercel Analytics
- 데이터베이스 성능 모니터링
- API 응답 시간 추적

---

## 향후 개선 사항

1. **캐싱 레이어:**
   - Redis 도입 검토
   - API 응답 캐싱

2. **실시간 기능:**
   - WebSocket 또는 Server-Sent Events
   - 실시간 이메일 알림

3. **성능:**
   - CDN 활용
   - 이미지 최적화 강화

4. **보안:**
   - Rate Limiting
   - CSRF 보호 강화

