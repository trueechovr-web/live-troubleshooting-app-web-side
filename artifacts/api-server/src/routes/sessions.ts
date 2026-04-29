import { Router } from "express";
import { db } from "@workspace/db";
import { sessionsTable, messagesTable, headsetsTable, insertSessionSchema, insertMessageSchema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

const formatSession = (s: typeof sessionsTable.$inferSelect & { headsetLabel?: string }) => ({
  ...s,
  headsetLabel: s.headsetLabel ?? s.headsetId,
  startedAt: s.startedAt?.toISOString(),
  endedAt: s.endedAt?.toISOString() ?? null,
});

router.get("/sessions", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: sessionsTable.id,
        headsetId: sessionsTable.headsetId,
        headsetLabel: headsetsTable.label,
        adminRole: sessionsTable.adminRole,
        techRole: sessionsTable.techRole,
        status: sessionsTable.status,
        roomCode: sessionsTable.roomCode,
        startedAt: sessionsTable.startedAt,
        endedAt: sessionsTable.endedAt,
      })
      .from(sessionsTable)
      .leftJoin(headsetsTable, eq(sessionsTable.headsetId, headsetsTable.id))
      .orderBy(sessionsTable.startedAt);

    res.json(rows.map((r) => formatSession(r)));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

router.post("/sessions", async (req, res) => {
  try {
    const { headsetId, role } = req.body as { headsetId: string; role: "admin" | "tech" };
    if (!headsetId || !role) {
      res.status(400).json({ error: "headsetId and role are required" });
      return;
    }

    const roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    const sessionId = randomUUID();

    const [session] = await db
      .insert(sessionsTable)
      .values({
        id: sessionId,
        headsetId,
        roomCode,
        status: "waiting",
        adminRole: role === "admin" ? "admin" : null,
        techRole: role === "tech" ? "tech" : null,
      })
      .returning();

    const [headset] = await db.select().from(headsetsTable).where(eq(headsetsTable.id, headsetId));

    res.status(201).json(
      formatSession({ ...session, headsetLabel: headset?.label ?? headsetId })
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to create session" });
  }
});

router.get("/sessions/:sessionId", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: sessionsTable.id,
        headsetId: sessionsTable.headsetId,
        headsetLabel: headsetsTable.label,
        adminRole: sessionsTable.adminRole,
        techRole: sessionsTable.techRole,
        status: sessionsTable.status,
        roomCode: sessionsTable.roomCode,
        startedAt: sessionsTable.startedAt,
        endedAt: sessionsTable.endedAt,
      })
      .from(sessionsTable)
      .leftJoin(headsetsTable, eq(sessionsTable.headsetId, headsetsTable.id))
      .where(eq(sessionsTable.id, req.params.sessionId));

    if (!rows.length) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.json(formatSession(rows[0]));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

router.delete("/sessions/:sessionId", async (req, res) => {
  try {
    const [session] = await db
      .update(sessionsTable)
      .set({ status: "ended", endedAt: new Date() })
      .where(eq(sessionsTable.id, req.params.sessionId))
      .returning();

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const [headset] = await db.select().from(headsetsTable).where(eq(headsetsTable.id, session.headsetId));
    res.json(formatSession({ ...session, headsetLabel: headset?.label }));
  } catch (err) {
    res.status(500).json({ error: "Failed to end session" });
  }
});

router.get("/sessions/:sessionId/messages", async (req, res) => {
  try {
    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.sessionId, req.params.sessionId))
      .orderBy(messagesTable.sentAt);

    res.json(
      messages.map((m) => ({
        ...m,
        sentAt: m.sentAt?.toISOString(),
      }))
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/sessions/:sessionId/messages", async (req, res) => {
  try {
    const { senderRole, content } = req.body as { senderRole: "admin" | "tech"; content: string };
    const [message] = await db
      .insert(messagesTable)
      .values({
        id: randomUUID(),
        sessionId: req.params.sessionId,
        senderRole,
        content,
      })
      .returning();

    res.status(201).json({ ...message, sentAt: message.sentAt?.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
