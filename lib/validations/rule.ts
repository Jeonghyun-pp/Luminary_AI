import { z } from "zod";

export const createRuleSchema = z.object({
  naturalLanguageText: z.string().min(10, "규칙 설명은 최소 10자 이상이어야 합니다.").max(1000),
});

export const ruleIdSchema = z.object({
  id: z.string().cuid(),
});

export const updateRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
});

export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type RuleIdInput = z.infer<typeof ruleIdSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;

