import { z } from "zod";

export const createTaskSchema = z.object({
  emailId: z.string().optional().nullable(),
  title: z.string().min(1, "제목은 필수입니다.").max(200),
  description: z.string().max(2000).optional().nullable(),
  dueAt: z.union([z.string().datetime(), z.null()]).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  dueAt: z.string().datetime().optional().nullable(),
});

export const taskIdSchema = z.object({
  id: z.string().min(1),
});

export const taskQuerySchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  dueToday: z.string().transform((val) => val === "true").optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskIdInput = z.infer<typeof taskIdSchema>;
export type TaskQueryInput = z.infer<typeof taskQuerySchema>;

