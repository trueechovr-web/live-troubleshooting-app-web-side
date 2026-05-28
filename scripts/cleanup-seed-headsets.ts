import { db, headsetsTable, sessionsTable, messagesTable, pointToEventsTable } from "@workspace/db";
import { inArray, like, or } from "drizzle-orm";

async function cleanupSeedHeadsets() {
  const SEED_SERIAL_PREFIXES = ["hs-oc-", "hs-demo-"];

  const seedHeadsets = await db
    .select({ id: headsetsTable.id, serialNumber: headsetsTable.serialNumber, label: headsetsTable.label })
    .from(headsetsTable)
    .where(or(...SEED_SERIAL_PREFIXES.map((prefix) => like(headsetsTable.serialNumber, `${prefix}%`))));

  if (seedHeadsets.length === 0) {
    console.log("[cleanup] No seed headsets found — already cleaned or never seeded.");
    process.exit(0);
  }

  console.log(`[cleanup] Found ${seedHeadsets.length} seed headset(s):`, seedHeadsets.map((h) => h.serialNumber));

  const headsetIds = seedHeadsets.map((h) => h.id);

  const sessionRows = await db
    .select({ id: sessionsTable.id })
    .from(sessionsTable)
    .where(inArray(sessionsTable.headsetId, headsetIds));

  const sessionIds = sessionRows.map((s) => s.id);
  console.log(`[cleanup] Found ${sessionIds.length} dependent session(s).`);

  if (sessionIds.length > 0) {
    const ptDel = await db.delete(pointToEventsTable).where(inArray(pointToEventsTable.sessionId, sessionIds)).returning({ id: pointToEventsTable.id });
    console.log(`[cleanup] Deleted ${ptDel.length} point_to_event(s).`);

    const msgDel = await db.delete(messagesTable).where(inArray(messagesTable.sessionId, sessionIds)).returning({ id: messagesTable.id });
    console.log(`[cleanup] Deleted ${msgDel.length} message(s).`);

    const sessDel = await db.delete(sessionsTable).where(inArray(sessionsTable.id, sessionIds)).returning({ id: sessionsTable.id });
    console.log(`[cleanup] Deleted ${sessDel.length} session(s).`);
  }

  const hsDel = await db.delete(headsetsTable).where(inArray(headsetsTable.id, headsetIds)).returning({ id: headsetsTable.id, serialNumber: headsetsTable.serialNumber });
  console.log(`[cleanup] Deleted ${hsDel.length} headset(s):`, hsDel.map((h) => h.serialNumber));

  console.log("[cleanup] Done.");
  process.exit(0);
}

cleanupSeedHeadsets().catch((err) => {
  console.error("[cleanup] Error:", err);
  process.exit(1);
});
