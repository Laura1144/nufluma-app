import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { chatMessageSchema } from "@/lib/validations";
import { chatWithData } from "@/services/ai-insights";

export async function POST(req: NextRequest) {
  const { ok } = await rateLimit(req, "chat");
  if (!ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const session = await auth();
  if (!session?.user?.workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = chatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { message, sessionId } = parsed.data;
  const workspaceId = session.user.workspaceId as string;
  const userId = session.user.id;

  // Get or create chat session
  let chatSessionId = sessionId;
  if (!chatSessionId) {
    const session_ = await db.chatSession.create({
      data: {
        workspaceId,
        userId,
        title: message.slice(0, 60),
      },
    });
    chatSessionId = session_.id;
  }

  // Fetch conversation history
  const history = await db.chatMessage.findMany({
    where: { sessionId: chatSessionId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const formattedHistory = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Generate AI response
  const result = await chatWithData(workspaceId, message, formattedHistory);

  // Persist messages
  await db.chatMessage.createMany({
    data: [
      { sessionId: chatSessionId!, role: "user", content: message },
      { sessionId: chatSessionId!, role: "assistant", content: result.content },
    ],
  });

  // Update session timestamp
  await db.chatSession.update({
    where: { id: chatSessionId! },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({
    content: result.content,
    sessionId: chatSessionId,
    data: result.data,
  });
}
