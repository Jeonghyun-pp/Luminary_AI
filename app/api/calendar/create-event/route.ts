import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createCalendarEvent } from "@/lib/calendar";
import { createCalendarEventSchema } from "@/lib/validations/calendar";
import { withErrorHandler } from "@/lib/errors/handler";

export const POST = withErrorHandler(async (request: Request) => {
  const user = await getCurrentUser();
  const body = await request.json();

  // Validate input
  const event = createCalendarEventSchema.parse(body);

  const eventId = await createCalendarEvent(user.id, event);

  return NextResponse.json({ success: true, eventId });
});

