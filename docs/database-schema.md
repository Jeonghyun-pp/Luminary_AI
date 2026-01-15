# 데이터베이스 스키마 문서

Prisma Schema의 상세 설명 및 관계도입니다.

## ERD (Entity Relationship Diagram)

```
User
├── Account[] (1:N)
├── Session[] (1:N)
├── Email[] (1:N)
├── InboxRule[] (1:N)
├── CalendarToken? (1:1)
└── Task[] (1:N)

Email
└── Task[] (1:N, optional)

Account
└── User (N:1)

Session
└── User (N:1)

InboxRule
└── User (N:1)

Task
├── User (N:1)
└── Email? (N:1, optional)

CalendarToken
└── User (N:1)
```

## 모델 상세

### User

사용자 정보를 저장합니다.

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  image     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  accounts       Account[]
  sessions       Session[]
  emails         Email[]
  rules          InboxRule[]
  calendarTokens CalendarToken?
  tasks          Task[]
}
```

**필드:**
- `id`: 고유 식별자 (CUID)
- `email`: 이메일 주소 (고유)
- `name`: 사용자 이름
- `image`: 프로필 이미지 URL

**관계:**
- 1:N Account (OAuth 계정)
- 1:N Session (세션)
- 1:N Email (이메일)
- 1:N InboxRule (규칙)
- 1:1 CalendarToken (캘린더 토큰)
- 1:N Task (작업)

---

### Account

OAuth 계정 정보를 저장합니다 (NextAuth.js).

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}
```

**필드:**
- `provider`: "google"
- `access_token`: Gmail/Calendar API 접근용 토큰
- `refresh_token`: 토큰 갱신용
- `expires_at`: 토큰 만료 시간

**인덱스:**
- `[provider, providerAccountId]` (고유)

---

### Session

사용자 세션 정보 (NextAuth.js).

```prisma
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

### Email

이메일 정보 및 AI 분류 결과를 저장합니다.

```prisma
model Email {
  id            String   @id @default(cuid())
  userId        String
  channel       String   // "gmail"
  externalId    String   // Gmail message ID
  threadId      String?
  from          String
  to            String
  cc            String?
  bcc           String?
  subject       String
  bodySnippet   String?  @db.Text
  bodyFullText  String?  @db.Text
  receivedAt    DateTime
  isRead        Boolean  @default(false)
  isStarred     Boolean  @default(false)

  // AI 분류 결과
  category      String?
  priorityScore Int?
  priorityLabel String?
  spamScore     Int?
  isSpam        Boolean  @default(false)
  summary       String?  @db.Text

  // 연동 정보
  calendarEventId String?
  tasks           Task[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId, receivedAt])
  @@index([userId, category])
  @@index([userId, priorityLabel])
  @@index([externalId])
}
```

**카테고리:**
- WORK, PERSONAL, FINANCE, PROMOTION, NEWSLETTER, SUPPORT, INFLUENCER_SPONSOR, SYSTEM, OTHER

**우선순위:**
- HIGH (80-100), MEDIUM (50-79), LOW (0-49)

**인덱스:**
- `[userId, receivedAt]`: 사용자별 시간순 조회
- `[userId, category]`: 카테고리 필터링
- `[userId, priorityLabel]`: 우선순위 필터링
- `[externalId]`: 중복 체크

---

### InboxRule

이메일 처리 규칙을 저장합니다.

```prisma
model InboxRule {
  id          String   @id @default(cuid())
  userId      String
  name        String
  description String?  @db.Text
  conditions  Json     // RuleCondition[]
  actions     Json     // RuleAction[]
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, isActive])
}
```

**JSON 구조:**

**conditions:**
```typescript
[
  {
    field: "subject",
    operator: "CONTAINS",
    value: "인보이스"
  }
]
```

**actions:**
```typescript
[
  {
    type: "SET_CATEGORY",
    value: { category: "FINANCE" }
  },
  {
    type: "SET_PRIORITY",
    value: { priority: "HIGH" }
  }
]
```

**인덱스:**
- `[userId, isActive]`: 활성 규칙 조회

---

### Task

작업 정보를 저장합니다.

```prisma
model Task {
  id          String   @id @default(cuid())
  userId      String
  emailId     String?
  title       String
  description String?  @db.Text
  status      String   @default("TODO") // TODO, IN_PROGRESS, DONE
  dueAt       DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, status])
  @@index([userId, dueAt])
}
```

**상태:**
- TODO: 할 일
- IN_PROGRESS: 진행 중
- DONE: 완료

**인덱스:**
- `[userId, status]`: 상태별 조회
- `[userId, dueAt]`: 마감일별 조회

---

### CalendarToken

Google Calendar 토큰을 저장합니다 (현재는 Account에 저장되어 사용되지 않을 수 있음).

```prisma
model CalendarToken {
  id           String   @id @default(cuid())
  userId       String   @unique
  provider     String   // "google"
  accessToken  String   @db.Text
  refreshToken String   @db.Text
  expiresAt    DateTime
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

---

## 데이터베이스 마이그레이션

### 초기 마이그레이션

```bash
npm run db:migrate
```

또는 스키마를 직접 푸시:

```bash
npm run db:push
```

### 마이그레이션 관리

**새 마이그레이션 생성:**
```bash
npm run db:migrate -- --name add_new_field
```

**마이그레이션 적용:**
```bash
npm run db:migrate deploy
```

**마이그레이션 롤백:**
```bash
npx prisma migrate reset
```

---

## 인덱스 전략

### 성능 최적화 인덱스

1. **Email 테이블:**
   - `[userId, receivedAt]`: 사용자별 시간순 조회
   - `[userId, category]`: 카테고리 필터링
   - `[userId, priorityLabel]`: 우선순위 필터링
   - `[externalId]`: 중복 체크

2. **Task 테이블:**
   - `[userId, status]`: 상태별 조회
   - `[userId, dueAt]`: 마감일별 조회

3. **InboxRule 테이블:**
   - `[userId, isActive]`: 활성 규칙 조회

---

## 데이터 무결성

### 외래 키 제약

- `onDelete: Cascade`: 부모 삭제 시 자식도 삭제
- `onDelete: SetNull`: 부모 삭제 시 자식의 외래 키를 NULL로 설정

### 고유 제약

- `User.email`: 이메일 중복 방지
- `Account.[provider, providerAccountId]`: OAuth 계정 중복 방지
- `Session.sessionToken`: 세션 토큰 중복 방지

---

## 쿼리 최적화 팁

### 효율적인 쿼리

```typescript
// ✅ 좋은 예: 인덱스 활용
await prisma.email.findMany({
  where: {
    userId: user.id,
    category: "WORK",
  },
  orderBy: { receivedAt: "desc" },
  take: 50,
});

// ❌ 나쁜 예: 인덱스 미활용
await prisma.email.findMany({
  where: {
    bodyFullText: { contains: "keyword" }, // 인덱스 없음
  },
});
```

### 페이지네이션

```typescript
const page = 1;
const limit = 50;
const skip = (page - 1) * limit;

const [emails, total] = await Promise.all([
  prisma.email.findMany({
    where: { userId: user.id },
    skip,
    take: limit,
    orderBy: { receivedAt: "desc" },
  }),
  prisma.email.count({ where: { userId: user.id } }),
]);
```

---

## 백업 및 복구

### 백업

**로컬:**
```bash
pg_dump -h localhost -U postgres inbox_solution > backup.sql
```

**클라우드 (Neon/Supabase):**
- 대시보드에서 백업 기능 사용
- 또는 pg_dump 사용

### 복구

```bash
psql -h localhost -U postgres inbox_solution < backup.sql
```

---

## 성능 모니터링

### 쿼리 성능 확인

```typescript
// Prisma 로깅 활성화
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

### 느린 쿼리 식별

- Prisma Studio 사용
- 데이터베이스 로그 확인
- EXPLAIN ANALYZE 사용

---

## 확장 고려사항

### 파티셔닝

대용량 데이터의 경우:
- Email 테이블을 날짜별로 파티셔닝
- 또는 아카이빙 전략 수립

### 읽기 복제

읽기 성능 향상:
- 읽기 전용 복제본 사용
- Prisma의 읽기 복제 지원 활용

