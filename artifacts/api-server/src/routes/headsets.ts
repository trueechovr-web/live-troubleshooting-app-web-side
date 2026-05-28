import { Router } from "express";
import { db } from "@workspace/db";
import { headsetsTable, customersTable, locationsTable, qrCodesTable, qrDictionaryTable, locationQrCodeSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

/* ── POST /headsets/register ── */
router.post("/headsets/register", async (req, res) => {
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
    const { label, firmwareVersion } = req.body as { label?: string; firmwareVersion?: string };

    if (!label && !firmwareVersion) {
      res.status(400).json({ error: "At least one of label or firmwareVersion is required" });
      return;
    }

    const updates: Partial<{ label: string; firmwareVersion: string }> = {};
    if (label) updates.label = label;
    if (firmwareVersion) updates.firmwareVersion = firmwareVersion;

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
    const [deleted] = await db
      .delete(headsetsTable)
      .where(eq(headsetsTable.id, req.params.headsetId))
      .returning({ id: headsetsTable.id });

    if (!deleted) { res.status(404).json({ error: "Headset not found" }); return; }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete headset" });
  }
});

/* ── GET /headsets/:headsetId/startup-data?locationId=... ── */
router.get("/headsets/:headsetId/startup-data", async (req, res) => {
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
      qrCodes: enabledQrCodes.map((r) => {
        const name = nameMap.get(r.qrValue);
        return {
          qrValue: r.qrValue,
          ...(name != null ? { name } : {}),
          position: { x: r.posX, y: r.posY, z: r.posZ },
          rotation: { x: r.rotX, y: r.rotY, z: r.rotZ, w: r.rotW },
        };
      }),
      nameDictionary: dictionary.map((d) => ({ qrValue: d.qrValue, name: d.name })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch startup data" });
  }
});

export default router;
