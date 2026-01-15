import { z } from "zod";

export const createCalendarEventSchema = z.object({
  title: z.string().min(1, "제목은 필수입니다.").max(200),
  type: z.enum(["MEETING", "DEADLINE", "REMINDER", "OTHER"]),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  dueTime: z.string().datetime().optional(),
  location: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateCalendarEventInput = z.infer<typeof createCalendarEventSchema>;

