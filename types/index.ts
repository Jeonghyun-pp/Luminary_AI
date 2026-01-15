// Rule types for inbox rules
export type ConditionField =
  | "fromEmail"
  | "fromDomain"
  | "subject"
  | "body"
  | "channel"
  | "language"
  | "containsKeywords"
  | "notContainsKeywords"
  | "isReply"
  | "hasAttachment";

export type ActionType =
  | "SET_PRIORITY"
  | "MARK_SPAM"
  | "MOVE_TO_FOLDER"
  | "CREATE_CALENDAR_EVENT"
  | "CREATE_TASK"
  | "AUTO_REPLY";

export type RuleCondition = {
  field: ConditionField;
  operator: "CONTAINS" | "NOT_CONTAINS" | "EQUALS" | "NOT_EQUALS" | "IN";
  value: string | string[];
};

export type RuleAction = {
  type: ActionType;
  value?: any; // e.g., { priority: "HIGH" }, { spam: true }, { calendarType: "FOLLOW_UP", dueInDays: 2 }
};

export type InboxRule = {
  id: string;
  userId: string;
  name: string;
  description?: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// Detected event from email
export type DetectedEvent = {
  title: string;
  type: "MEETING" | "DEADLINE" | "REMINDER" | "OTHER";
  startTime?: string; // ISO
  endTime?: string; // ISO
  dueTime?: string; // ISO
  location?: string;
  notes?: string;
};

// Sponsorship information extracted from email
export type SponsorshipInfo = {
  reward?: string; // 보상
  requiredContent?: string; // 요구 콘텐츠
  deadline?: string; // 마감일자
  description?: string; // 상세 설명
};

// Email analysis (자유 텍스트 기반 항목화 요약)
export type EmailAnalysis = {
  summary?: string; // 항목화된 요약 (새 형식)
  // Backward compatibility
  product?: string | null; // 제품 (구 형식)
  type?: string | null; // 유형 (구 형식)
  requirements?: string | null; // 요구조건 (구 형식)
  schedule?: string | null; // 일정 (구 형식)
};

// Display fields for email analysis
export type AnalysisDisplayField = "product" | "type" | "requirements" | "schedule" | "reward";

// Task status
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

// Email category
export type EmailCategory =
  | "WORK"
  | "PERSONAL"
  | "FINANCE"
  | "PROMOTION"
  | "NEWSLETTER"
  | "SUPPORT"
  | "INFLUENCER_SPONSOR"
  | "SYSTEM"
  | "OTHER";

// Priority label
export type PriorityLabel = "HIGH" | "MEDIUM" | "LOW";

// Email type (matches Prisma model)
export type Email = {
  id: string;
  userId: string;
  channel: string;
  externalId: string;
  threadId: string | null;
  from: string;
  to: string;
  cc: string | null;
  bcc: string | null;
  subject: string;
  bodySnippet: string | null;
  bodyFullText: string | null;
  receivedAt: Date;
  isRead: boolean;
  isStarred: boolean;
  isTrashed?: boolean; // 휴지통 여부
  trashedAt?: Date | null; // 휴지통으로 이동한 시간
  priorityScore: number | null;
  priorityLabel: PriorityLabel | null;
  spamScore: number | null;
  isSpam: boolean;
  summary: string | null;
  emailAnalysis: EmailAnalysis | null; // 제품, 유형, 일정 분석
  calendarEventId: string | null;
  sponsorshipInfo: SponsorshipInfo | null;
  createdAt: Date;
  updatedAt: Date;
};

// Task type (matches Prisma model)
export type Task = {
  id: string;
  userId: string;
  emailId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

