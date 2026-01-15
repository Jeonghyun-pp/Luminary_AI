import { z } from "zod";

export const emailQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).default("50"),
});

export const emailIdSchema = z.object({
  id: z.string().min(1).max(200), // Firestore document IDs can be any string, not just CUID
});

export type EmailQueryInput = z.infer<typeof emailQuerySchema>;
export type EmailIdInput = z.infer<typeof emailIdSchema>;

