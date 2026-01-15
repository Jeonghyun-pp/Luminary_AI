# AI Agent Tools 문서

AI Inbox Solution에서 사용하는 AI Agent Tools의 상세 설명입니다.

## 개요

OpenAI Function Calling을 사용하여 GPT-4o-mini가 이메일 처리 작업을 수행할 수 있도록 설계된 툴 시스템입니다.

## 툴 목록

### 1. classifyEmailTool

**목적:** 이메일을 카테고리, 우선순위, 스팸 여부로 분류

**입력:**
- `emailId`: 이메일 ID
- `userId`: 이메일 소유자 ID
- `userId`: 이메일 소유자 ID
- `userId`: 이메일 소유자 ID
- `userId`: 이메일 소유자 ID

**처리 과정:**
1. 데이터베이스에서 이메일 조회
2. OpenAI API 호출 (GPT-4o-mini)
3. JSON 응답 파싱:
   - `category`: WORK, PERSONAL, FINANCE 등
   - `priorityScore`: 0-100
   - `priorityLabel`: HIGH, MEDIUM, LOW
   - `spamScore`: 0-100
   - `isSpam`: boolean
4. 데이터베이스 업데이트

**사용 예시:**
```typescript
await classifyEmailTool("email-id-123", "user-abc");
```

**API 엔드포인트:**
- `POST /api/emails/[id]/classify`

---

### 2. summarizeEmailTool

**목적:** 이메일 내용을 요약

**입력:**
- `emailId`: 이메일 ID

**처리 과정:**
1. 데이터베이스에서 이메일 조회
2. OpenAI API 호출
3. 요약 텍스트 생성
4. 데이터베이스에 요약 저장

**사용 예시:**
```typescript
await summarizeEmailTool("email-id-123", "user-abc");
```

**API 엔드포인트:**
- `POST /api/emails/[id]/summarize`

---

### 3. extractScheduleFromEmailTool

**목적:** 이메일에서 일정 정보 추출

**입력:**
- `emailId`: 이메일 ID

**출력:**
```typescript
{
  title: string;
  type: "MEETING" | "DEADLINE" | "REMINDER" | "OTHER";
  startTime?: string; // ISO
  endTime?: string;   // ISO
  dueTime?: string;   // ISO
  location?: string;
  notes?: string;
}
```

**처리 과정:**
1. 데이터베이스에서 이메일 조회
2. OpenAI API 호출
3. 일정 정보 추출
4. DetectedEvent 객체 반환

**사용 예시:**
```typescript
const event = await extractScheduleFromEmailTool("email-id-123", "user-abc");
if (event) {
  await createCalendarEvent(userId, event);
}
```

**API 엔드포인트:**
- `POST /api/emails/[id]/extract-schedule`

---

### 4. parseRuleFromNaturalLanguageTool

**목적:** 자연어 규칙 설명을 구조화된 규칙으로 변환

**입력:**
- `userId`: 사용자 ID
- `naturalLanguageText`: 자연어 규칙 설명

**출력:**
```typescript
{
  name: string;
  description: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
}
```

**처리 과정:**
1. OpenAI API 호출 (규칙 파싱)
2. JSON 응답 파싱
3. 데이터베이스에 규칙 저장
4. InboxRule 객체 반환

**사용 예시:**
```typescript
const rule = await parseRuleFromNaturalLanguageTool(
  userId,
  "인보이스 관련 메일은 FINANCE로 분류하고 HIGH 우선순위로 설정"
);
```

**API 엔드포인트:**
- `POST /api/rules`

---

### 5. applyRulesToEmailTool

**목적:** 활성화된 규칙을 이메일에 적용

**입력:**
- `emailId`: 이메일 ID

**처리 과정:**
1. 이메일 조회
2. 사용자의 활성화된 규칙 조회
3. 각 규칙의 조건 평가
4. 조건 일치 시 액션 실행
5. 이메일 업데이트

**조건 평가:**
- `fromEmail`: 발신자 이메일
- `fromDomain`: 발신자 도메인
- `subject`: 제목
- `body`: 본문
- `containsKeywords`: 키워드 포함
- 등등...

**액션 타입:**
- `SET_CATEGORY`: 카테고리 설정
- `SET_PRIORITY`: 우선순위 설정
- `MARK_SPAM`: 스팸 표시

**사용 예시:**
```typescript
await applyRulesToEmailTool("email-id-123", "user-abc");
```

**자동 호출:**
- 새 이메일 저장 시 자동 호출

---

### 6. createTaskFromEmailTool

**목적:** 이메일에서 작업 생성

**입력:**
- `emailId`: 이메일 ID
- `userId`: 소유자 ID
- `title`: 작업 제목
- `description`: 작업 설명 (선택)
- `dueAt`: 마감일 (선택)

**처리 과정:**
1. 데이터베이스에 작업 생성
2. 이메일과 작업 연결
3. Task 객체 반환

**사용 예시:**
```typescript
await createTaskFromEmailTool(
  "email-id-123",
  "user-abc",
  "답장하기",
  "이메일 답장 필요",
  "2024-12-31T23:59:59Z"
);
```

**API 엔드포인트:**
- `POST /api/tasks`

---

## Function Calling 구조

### OpenAI Function Calling

각 툴은 OpenAI Function Calling 형식으로 정의됩니다:

```typescript
{
  type: "function",
  function: {
    name: "classifyEmail",
    description: "Classify an email by category, priority, and spam status",
    parameters: {
      type: "object",
      properties: {
        emailId: {
          type: "string",
          description: "The ID of the email to classify"
        }
      },
      required: ["emailId"]
    }
  }
}
```

### 툴 실행 흐름

```
1. 사용자 요청 또는 자동 트리거
   ↓
2. OpenAI API 호출 (function calling)
   ↓
3. GPT가 적절한 툴 선택
   ↓
4. 툴 함수 실행
   ↓
5. 결과 반환 및 데이터베이스 업데이트
```

---

## 프롬프트 엔지니어링

### System Prompts

각 툴은 특화된 system prompt를 사용합니다:

**분류 프롬프트:**
```
You are an email classification assistant. Analyze the email and classify it by:
1. Category: WORK, PERSONAL, FINANCE, etc.
2. Priority: HIGH (80-100), MEDIUM (50-79), LOW (0-49)
3. Spam: true or false with a spam score (0-100)
```

**규칙 파싱 프롬프트:**
```
You are a rule parsing assistant. Convert natural language rule descriptions 
into structured rule objects with conditions and actions.
```

### Temperature 설정

- **분류/요약:** 0.3 (일관성 중요)
- **규칙 파싱:** 0.3 (정확성 중요)
- **일정 추출:** 0.3 (정확성 중요)

---

## 에러 처리

### 재시도 로직

- OpenAI API 호출 실패 시 최대 3회 재시도
- 지수 백오프 적용

### 폴백 전략

- AI 호출 실패 시 기본값 사용
- 사용자에게 명확한 에러 메시지 표시

---

## 비용 최적화

### 모델 선택

- GPT-4o-mini 사용 (비용 효율)
- 필요시 GPT-4로 업그레이드 가능

### 호출 최적화

- 불필요한 호출 방지
- 배치 처리 고려
- 캐싱 활용 (향후)

---

## 모니터링

### 로깅

- 모든 AI 호출 로깅
- 응답 시간 측정
- 에러 추적

### 메트릭

- API 호출 횟수
- 성공/실패 비율
- 평균 응답 시간
- 비용 추적

---

## 확장 가능성

### 새로운 툴 추가

1. `lib/agent/` 폴더에 새 툴 파일 생성
2. `tools.ts`에 툴 등록
3. Function definition 추가
4. API 엔드포인트 생성 (필요시)

### 예시: 새 툴 추가

```typescript
// lib/agent/new-tool.ts
export async function newToolTool(param: string) {
  // 구현
}

// lib/agent/tools.ts
export const agentTools = {
  // ... 기존 툴들
  newTool: newToolTool,
};
```

---

## 테스트

### 단위 테스트

각 툴의 단위 테스트 작성 권장:

```typescript
describe("classifyEmailTool", () => {
  it("should classify email correctly", async () => {
    // 테스트 코드
  });
});
```

### 통합 테스트

전체 플로우 테스트:

```typescript
describe("Email processing flow", () => {
  it("should fetch, classify, and apply rules", async () => {
    // 테스트 코드
  });
});
```

