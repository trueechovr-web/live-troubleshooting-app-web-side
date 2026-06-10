import { Router, Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { headsetsTable, customersTable, locationsTable, qrCodesTable, qrDictionaryTable, locationQrCodeSettingsTable, sessionsTable, messagesTable, pointToEventsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

const PROVISION_TOKEN = process.env.HEADSET_PROVISION_TOKEN;

function requireProvisionToken(req: Request, res: Response, next: NextFunction) {
  if (!PROVISION_TOKEN) { next(); return; }
  const auth = req.headers["authorization"] ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (bearer !== PROVISION_TOKEN) {
    res.status(401).json({ error: "Invalid or missing provisioning token" });
    return;
  }
  next();
}

/* ── In-memory setup code store (survives for 24 h, cleared on restart) ── */
interface SetupCodeEntry { customerId: string; locationId: string; expiresAt: number; }
const setupCodeStore = new Map<string, SetupCodeEntry>();
const SETUP_CODE_TTL_MS = 24 * 60 * 60 * 1000;
const SETUP_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 unambiguous chars

function makeSetupCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += SETUP_CODE_CHARS[Math.floor(Math.random() * SETUP_CODE_CHARS.length)];
  }
  return code;
}

// Hourly sweep for expired codes
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of setupCodeStore) {
    if (entry.expiresAt < now) setupCodeStore.delete(code);
  }
}, 60 * 60 * 1000).unref();

/* ── POST /headsets/setup-code ── */
// Called from the admin portal browser when generating a setup QR.
// Returns a short opaque code the headset exchanges for the full config.
router.post("/headsets/setup-code", async (req, res) => {
  const { customerId, locationId } = req.body as { customerId?: string; locationId?: string };
  if (!customerId || !locationId) {
    res.status(400).json({ error: "customerId and locationId are required" });
    return;
  }
  const code = makeSetupCode();
  setupCodeStore.set(code, { customerId, locationId, expiresAt: Date.now() + SETUP_CODE_TTL_MS });
  res.json({ code, expiresAt: new Date(Date.now() + SETUP_CODE_TTL_MS).toISOString() });
});

/* ── GET /headsets/setup-exchange?code=XXXXXXXX ── */
// Called by the headset after scanning the QR. One-time use — code deleted on success.
router.get("/headsets/setup-exchange", (req, res) => {
  const { code } = req.query as { code?: string };
  if (!code) { res.status(400).json({ error: "code is required" }); return; }
  const entry = setupCodeStore.get(code);
  if (!entry) { res.status(404).json({ error: "Setup code not found or expired" }); return; }
  if (entry.expiresAt < Date.now()) {
    setupCodeStore.delete(code);
    res.status(410).json({ error: "Setup code has expired" }); return;
  }
  setupCodeStore.delete(code); // one-time use
  res.json({ customerId: entry.customerId, locationId: entry.locationId, token: PROVISION_TOKEN ?? null });
});

/* ── GET /setup/:code ── */
// Unity headset path: GET {apiBaseUrl}/setup/{setupCode}
// Alias for the setup-exchange endpoint — same one-time exchange logic.
router.get("/setup/:code", (req, res) => {
  const { code } = req.params;
  const entry = setupCodeStore.get(code);
  if (!entry) { res.status(404).json({ error: "Setup code not found or expired" }); return; }
  if (entry.expiresAt < Date.now()) {
    setupCodeStore.delete(code);
    res.status(410).json({ error: "Setup code has expired" }); return;
  }
  setupCodeStore.delete(code); // one-time use
  res.json({ customerId: entry.customerId, locationId: entry.locationId, token: PROVISION_TOKEN ?? null });
});

/* ── POST /headsets/register ── */
router.post("/headsets/register", requireProvisionToken, async (req, res) => {
  try {
    const { serialNumber, customerId, firmwareVersion, label } = req.body as {
      serialNumber?: string;
      customerId?: string;
      firmwareVersion?: string;
      label?: string;
    };

    if (!serialNumber || !customerId) {
      res.status(400).json({ error: "serialNumber and customerId are required" });
      return;
    }

    const [customer] = await db.select({ id: customersTable.id }).from(customersTable).where(eq(customersTable.id, customerId));
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    const [existing] = await db
      .select({
        id: headsetsTable.id,
        serialNumber: headsetsTable.serialNumber,
        label: headsetsTable.label,
        customerId: headsetsTable.customerId,
        customerName: customersTable.name,
        status: headsetsTable.status,
        batteryLevel: headsetsTable.batteryLevel,
        firmwareVersion: headsetsTable.firmwareVersion,
        lastSeen: headsetsTable.lastSeen,
      })
      .from(headsetsTable)
      .leftJoin(customersTable, eq(headsetsTable.customerId, customersTable.id))
      .where(and(eq(headsetsTable.serialNumber, serialNumber), eq(headsetsTable.customerId, customerId)));

    if (existing) {
      if (firmwareVersion && firmwareVersion !== existing.firmwareVersion) {
        await db.update(headsetsTable).set({ firmwareVersion, lastSeen: new Date() }).where(eq(headsetsTable.id, existing.id));
        existing.firmwareVersion = firmwareVersion;
      }
      res.status(200).json({ ...existing, customerName: existing.customerName ?? "Unknown", lastSeen: existing.lastSeen?.toISOString() });
      return;
    }

    const id = randomUUID();
    const derivedLabel = label ?? `Headset ${serialNumber.slice(-6)}`;
    const [inserted] = await db
      .insert(headsetsTable)
      .values({ id, serialNumber, customerId, label: derivedLabel, firmwareVersion: firmwareVersion ?? "1.0.0" })
      .returning();

    const [customerRow] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, customerId));

    res.status(201).json({
      ...inserted,
      customerName: customerRow?.name ?? "Unknown",
      lastSeen: inserted.lastSeen?.toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to register headset" });
  }
});

router.get("/headsets", async (req, res) => {
  try {
    const { status } = req.query as { status?: "online" | "offline" | "busy" };

    const rows = await db
      .select({
        id: headsetsTable.id,
        serialNumber: headsetsTable.serialNumber,
        label: headsetsTable.label,
        customerId: headsetsTable.customerId,
        customerName: customersTable.name,
        status: headsetsTable.status,
        batteryLevel: headsetsTable.batteryLevel,
        firmwareVersion: headsetsTable.firmwareVersion,
        lastSeen: headsetsTable.lastSeen,
      })
      .from(headsetsTable)
      .leftJoin(customersTable, eq(headsetsTable.customerId, customersTable.id));

    const filtered = status ? rows.filter((h) => h.status === status) : rows;

    res.json(
      filtered.map((h) => ({
        ...h,
        customerName: h.customerName ?? "Unknown",
        lastSeen: h.lastSeen?.toISOString(),
      }))
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch headsets" });
  }
});

/* ── GET /headsets/:headsetId ── */
router.get("/headsets/:headsetId", async (req, res) => {
  try {
    const [row] = await db
      .select({
        id: headsetsTable.id,
        serialNumber: headsetsTable.serialNumber,
        label: headsetsTable.label,
        customerId: headsetsTable.customerId,
        customerName: customersTable.name,
        status: headsetsTable.status,
        batteryLevel: headsetsTable.batteryLevel,
        firmwareVersion: headsetsTable.firmwareVersion,
        lastSeen: headsetsTable.lastSeen,
      })
      .from(headsetsTable)
      .leftJoin(customersTable, eq(headsetsTable.customerId, customersTable.id))
      .where(eq(headsetsTable.id, req.params.headsetId));

    if (!row) { res.status(404).json({ error: "Headset not found" }); return; }

    res.json({ ...row, customerName: row.customerName ?? "Unknown", lastSeen: row.lastSeen?.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch headset" });
  }
});

/* ── PATCH /headsets/:headsetId ── */
router.patch("/headsets/:headsetId", async (req, res) => {
  try {
    const { label, firmwareVersion, status } = req.body as { label?: string; firmwareVersion?: string; status?: "online" | "offline" | "busy" };

    if (!label && !firmwareVersion && !status) {
      res.status(400).json({ error: "At least one of label, firmwareVersion, or status is required" });
      return;
    }

    const updates: Partial<{ label: string; firmwareVersion: string; status: "online" | "offline" | "busy" }> = {};
    if (label) updates.label = label;
    if (firmwareVersion) updates.firmwareVersion = firmwareVersion;
    if (status) updates.status = status;

    const [updated] = await db
      .update(headsetsTable)
      .set(updates)
      .where(eq(headsetsTable.id, req.params.headsetId))
      .returning();

    if (!updated) { res.status(404).json({ error: "Headset not found" }); return; }

    const [customerRow] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, updated.customerId));

    res.json({ ...updated, customerName: customerRow?.name ?? "Unknown", lastSeen: updated.lastSeen?.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to update headset" });
  }
});

/* ── DELETE /headsets/:headsetId ── */
router.delete("/headsets/:headsetId", async (req, res) => {
  try {
    const [headset] = await db
      .select({ id: headsetsTable.id })
      .from(headsetsTable)
      .where(eq(headsetsTable.id, req.params.headsetId));

    if (!headset) { res.status(404).json({ error: "Headset not found" }); return; }

    // Cascade-delete session dependencies before removing the headset
    const sessionRows = await db
      .select({ id: sessionsTable.id })
      .from(sessionsTable)
      .where(eq(sessionsTable.headsetId, headset.id));

    if (sessionRows.length > 0) {
      const sessionIds = sessionRows.map((s) => s.id);
      await db.delete(pointToEventsTable).where(inArray(pointToEventsTable.sessionId, sessionIds));
      await db.delete(messagesTable).where(inArray(messagesTable.sessionId, sessionIds));
      await db.delete(sessionsTable).where(inArray(sessionsTable.id, sessionIds));
    }

    await db.delete(headsetsTable).where(eq(headsetsTable.id, headset.id));

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete headset" });
  }
});

/* ── GET /headsets/:headsetId/startup-data?locationId=... ── */
router.get("/headsets/:headsetId/startup-data", requireProvisionToken, async (req, res) => {
  try {
    const { locationId } = req.query as { locationId?: string };
    if (!locationId) {
      res.status(400).json({ error: "locationId query parameter is required" });
      return;
    }

    const [headset] = await db
      .select()
      .from(headsetsTable)
      .where(eq(headsetsTable.id, req.params.headsetId));
    if (!headset) { res.status(404).json({ error: "Headset not found" }); return; }

    const [location] = await db
      .select()
      .from(locationsTable)
      .where(eq(locationsTable.id, locationId));
    if (!location) { res.status(404).json({ error: "Location not found" }); return; }

    // Enforce customer boundary — headset and location must belong to the same customer
    if (location.customerId !== headset.customerId) {
      res.status(403).json({ error: "Location does not belong to the headset's customer" });
      return;
    }

    // All validation passed — mark the headset online and refresh lastSeen
    await db.update(headsetsTable)
      .set({ status: "online", lastSeen: new Date() })
      .where(eq(headsetsTable.id, headset.id));

    const [qrCodes, dictionary, settings] = await Promise.all([
      db.select().from(qrCodesTable).where(eq(qrCodesTable.locationId, locationId)),
      db.select().from(qrDictionaryTable).where(eq(qrDictionaryTable.customerId, headset.customerId)),
      db.select().from(locationQrCodeSettingsTable).where(eq(locationQrCodeSettingsTable.locationId, locationId)),
    ]);

    const dictEntryIdByQrValue = new Map(dictionary.map((d) => [d.qrValue, d.id]));
    const settingsMap = new Map(settings.map((s) => [s.qrDictionaryEntryId, s.enabled]));

    const enabledQrCodes = qrCodes.filter((qr) => {
      const entryId = dictEntryIdByQrValue.get(qr.qrValue);
      if (!entryId) return true;
      return settingsMap.get(entryId) ?? true;
    });

    const nameMap = new Map(dictionary.map((d) => [d.qrValue, d.name]));

    res.json({
      locationId: location.id,
      locationName: location.name,
      version: "1.0",
      qrCodes: enabledQrCodes.map((r) => ({
        qrValue: r.qrValue,
        name: nameMap.get(r.qrValue) ?? "",
        position: { x: r.posX, y: r.posY, z: r.posZ },
        rotation: { x: r.rotX, y: r.rotY, z: r.rotZ, w: r.rotW },
        metadata: "",
      })),
      nameDictionary: dictionary.map((d) => ({ qrValue: d.qrValue, name: d.name })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch startup data" });
  }
});

export default router;
