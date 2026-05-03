import { Router } from "express";
import { db } from "@workspace/db";
import { sessionsTable, messagesTable, headsetsTable, customersTable, pointToEventsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

async function generateSessionSummary(
  transcript: string | null,
  pointToEvents: { objectName: string; triggeredAt: Date }[],
  adminNotes?: { issueDescription: string; resolved: boolean } | null,
): Promise<string | null> {
  if (!openai) return null;
  if (!transcript && pointToEvents.length === 0 && !adminNotes) return null;

  const pointToPart =
    pointToEvents.length > 0
      ? `Objects highlighted during the session: ${pointToEvents.map((e) => e.objectName).join(", ")}.`
      : "No objects were highlighted during this session.";

  const transcriptPart = transcript
    ? `\n\nSession transcript:\n${transcript}`
    : "\n\nNo audio transcript was captured for this session.";

  const adminNotesPart = adminNotes
    ? `\n\nAdmin reported issue: "${adminNotes.issueDescription}". Resolution status: ${adminNotes.resolved ? "Resolved successfully" : "Not resolved — follow-up required"}.`
    : "";

  const prompt = `You are summarizing a VR remote assistance support session. Write a 2-3 sentence plain-English summary describing what was discussed and any objects that were inspected or pointed to. Be concise and factual.\n\n${pointToPart}${adminNotesPart}${transcriptPart}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
    });
    return response.choices[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

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

    // Generate AI summary asynchronously (after response is sent)
    const [headsetWithCustomer] = await db
      .select({ customerId: headsetsTable.customerId })
      .from(headsetsTable)
      .where(eq(headsetsTable.id, session.headsetId));

    if (headsetWithCustomer) {
      const [customer] = await db
        .select({ sessionHistoryEnabled: customersTable.sessionHistoryEnabled })
        .from(customersTable)
        .where(eq(customersTable.id, headsetWithCustomer.customerId));

      if (customer?.sessionHistoryEnabled) {
        const pointToEvents = await db
          .select()
          .from(pointToEventsTable)
          .where(eq(pointToEventsTable.sessionId, req.params.sessionId));

        const summary = await generateSessionSummary(session.transcript, pointToEvents);
        if (summary) {
          await db
            .update(sessionsTable)
            .set({ summary })
            .where(eq(sessionsTable.id, req.params.sessionId));
        }
      }
    }
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

router.post("/sessions/:sessionId/transcript-chunk", async (req, res) => {
  try {
    const { speaker, text } = req.body as { speaker: "admin" | "tech"; text: string };
    if (!speaker || !text?.trim()) {
      res.status(400).json({ error: "speaker and text are required" });
      return;
    }
    const timestamp = new Date().toISOString();
    const chunk = `[${speaker.toUpperCase()} ${timestamp}] ${text.trim()}`;
    await db
      .update(sessionsTable)
      .set({ transcript: sql`coalesce(${sessionsTable.transcript}, '') || ${"\n" + chunk}` })
      .where(eq(sessionsTable.id, req.params.sessionId));
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: "Failed to append transcript chunk" });
  }
});

router.get("/customers/:customerId/session-history", async (req, res) => {
  try {
    const [customer] = await db
      .select({ sessionHistoryEnabled: customersTable.sessionHistoryEnabled })
      .from(customersTable)
      .where(eq(customersTable.id, req.params.customerId));

    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    if (!customer.sessionHistoryEnabled) {
      res.json([]);
      return;
    }

    const rows = await db
      .select({
        id: sessionsTable.id,
        headsetId: sessionsTable.headsetId,
        headsetLabel: headsetsTable.label,
        startedAt: sessionsTable.startedAt,
        endedAt: sessionsTable.endedAt,
        summary: sessionsTable.summary,
        adminNotes: sessionsTable.adminNotes,
        resolved: sessionsTable.resolved,
      })
      .from(sessionsTable)
      .leftJoin(headsetsTable, eq(sessionsTable.headsetId, headsetsTable.id))
      .where(
        and(
          eq(headsetsTable.customerId, req.params.customerId),
          eq(sessionsTable.status, "ended"),
        )
      )
      .orderBy(sql`${sessionsTable.startedAt} desc`);

    const items = rows.map((r) => {
      const durationSeconds =
        r.endedAt && r.startedAt
          ? Math.round((r.endedAt.getTime() - r.startedAt.getTime()) / 1000)
          : null;
      return {
        id: r.id,
        headsetId: r.headsetId,
        headsetLabel: r.headsetLabel ?? r.headsetId,
        startedAt: r.startedAt.toISOString(),
        endedAt: r.endedAt?.toISOString() ?? null,
        durationSeconds,
        summary: r.summary ?? null,
        adminNotes: r.adminNotes ?? null,
        resolved: r.resolved ?? null,
      };
    });

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch session history" });
  }
});

router.patch("/sessions/:sessionId/feedback", async (req, res) => {
  try {
    const { issueDescription, resolved } = req.body as { issueDescription?: string; resolved?: boolean };
    if (typeof issueDescription !== "string" || issueDescription.trim() === "" || typeof resolved !== "boolean") {
      res.status(400).json({ error: "issueDescription (string) and resolved (boolean) are required" });
      return;
    }

    const [session] = await db
      .update(sessionsTable)
      .set({ adminNotes: issueDescription.trim(), resolved })
      .where(eq(sessionsTable.id, req.params.sessionId))
      .returning();

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.status(204).end();

    // Re-generate summary with admin notes included (fire-and-forget)
    if (openai) {
      const [headsetRow] = await db
        .select({ customerId: headsetsTable.customerId })
        .from(headsetsTable)
        .where(eq(headsetsTable.id, session.headsetId));

      if (headsetRow) {
        const [customer] = await db
          .select({ sessionHistoryEnabled: customersTable.sessionHistoryEnabled })
          .from(customersTable)
          .where(eq(customersTable.id, headsetRow.customerId));

        if (customer?.sessionHistoryEnabled) {
          const pointToEvents = await db
            .select()
            .from(pointToEventsTable)
            .where(eq(pointToEventsTable.sessionId, req.params.sessionId));

          const summary = await generateSessionSummary(
            session.transcript,
            pointToEvents,
            { issueDescription: issueDescription.trim(), resolved },
          );
          if (summary) {
            await db
              .update(sessionsTable)
              .set({ summary })
              .where(eq(sessionsTable.id, req.params.sessionId));
          }
        }
      }
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to save session feedback" });
  }
});

router.get("/sessions/:sessionId/point-to-events", async (req, res) => {
  try {
    const events = await db
      .select({
        id: pointToEventsTable.id,
        sessionId: pointToEventsTable.sessionId,
        objectName: pointToEventsTable.objectName,
        createdAt: pointToEventsTable.triggeredAt,
      })
      .from(pointToEventsTable)
      .where(eq(pointToEventsTable.sessionId, req.params.sessionId))
      .orderBy(pointToEventsTable.triggeredAt);
    res.json(events.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch point-to events" });
  }
});

export default router;
