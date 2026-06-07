import { Router } from "express";
import { db } from "@workspace/db";
import { locationsTable, qrCodesTable, customersTable, qrDictionaryTable, locationQrCodeSettingsTable } from "@workspace/db";
import { eq, inArray, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { CreateLocationBody, ImportLocationQrCodesBody } from "@workspace/api-zod";

const router = Router();

/* ── helpers ── */
async function buildLocationSummaries(locationIds: string[]) {
  if (locationIds.length === 0) return new Map<string, { count: number; lastAt: Date | null; lastHeadset: string | null }>();
  const qrRows = await db
    .select()
    .from(qrCodesTable)
    .where(inArray(qrCodesTable.locationId, locationIds));

  const map = new Map<string, { count: number; lastAt: Date | null; lastHeadset: string | null }>();
  for (const r of qrRows) {
    const cur = map.get(r.locationId) ?? { count: 0, lastAt: null, lastHeadset: null };
    cur.count += 1;
    if (!cur.lastAt || r.calibratedAt > cur.lastAt) {
      cur.lastAt = r.calibratedAt;
      cur.lastHeadset = r.headsetId ?? null;
    }
    map.set(r.locationId, cur);
  }
  return map;
}

/* ── GET /customers/:customerId/locations ── */
router.get("/customers/:customerId/locations", async (req, res) => {
  try {
    const [customer] = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(eq(customersTable.id, req.params.customerId));
    if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }

    const locations = await db
      .select()
      .from(locationsTable)
      .where(eq(locationsTable.customerId, req.params.customerId))
      .orderBy(locationsTable.createdAt);

    const stats = await buildLocationSummaries(locations.map((l) => l.id));

    res.json(
      locations.map((loc) => {
        const s = stats.get(loc.id);
        return {
          id: loc.id,
          customerId: loc.customerId,
          name: loc.name,
          createdAt: loc.createdAt.toISOString(),
          qrCodeCount: s?.count ?? 0,
          lastCalibratedAt: s?.lastAt ? s.lastAt.toISOString() : undefined,
          lastCalibratedByHeadsetId: s?.lastHeadset ?? undefined,
        };
      }),
    );
  } catch {
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});

/* ── POST /customers/:customerId/locations ── */
router.post("/customers/:customerId/locations", async (req, res) => {
  try {
    const parsed = CreateLocationBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: String(parsed.error) }); return; }

    const [customer] = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(eq(customersTable.id, req.params.customerId));
    if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }

    const [loc] = await db
      .insert(locationsTable)
      .values({ id: randomUUID(), customerId: req.params.customerId, name: parsed.data.name })
      .returning();

    res.status(201).json({
      id: loc.id,
      customerId: loc.customerId,
      name: loc.name,
      createdAt: loc.createdAt.toISOString(),
      qrCodeCount: 0,
    });
  } catch {
    res.status(500).json({ error: "Failed to create location" });
  }
});

/* ── PUT /customers/:customerId/locations/:locationId ── */
router.put("/customers/:customerId/locations/:locationId", async (req, res) => {
  try {
    const parsed = CreateLocationBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: String(parsed.error) }); return; }

    const [existing] = await db
      .select()
      .from(locationsTable)
      .where(eq(locationsTable.id, req.params.locationId));
    if (!existing || existing.customerId !== req.params.customerId) {
      res.status(404).json({ error: "Location not found" });
      return;
    }

    const [updated] = await db
      .update(locationsTable)
      .set({ name: parsed.data.name })
      .where(eq(locationsTable.id, req.params.locationId))
      .returning();

    const stats = await buildLocationSummaries([updated.id]);
    const s = stats.get(updated.id);

    res.json({
      id: updated.id,
      customerId: updated.customerId,
      name: updated.name,
      createdAt: updated.createdAt.toISOString(),
      qrCodeCount: s?.count ?? 0,
      lastCalibratedAt: s?.lastAt ? s.lastAt.toISOString() : undefined,
      lastCalibratedByHeadsetId: s?.lastHeadset ?? undefined,
    });
  } catch {
    res.status(500).json({ error: "Failed to update location" });
  }
});

/* ── DELETE /customers/:customerId/locations/:locationId ── */
router.delete("/customers/:customerId/locations/:locationId", async (req, res) => {
  try {
    const [loc] = await db
      .select()
      .from(locationsTable)
      .where(eq(locationsTable.id, req.params.locationId));
    if (!loc || loc.customerId !== req.params.customerId) {
      res.status(404).json({ error: "Location not found" });
      return;
    }
    await db.delete(qrCodesTable).where(eq(qrCodesTable.locationId, req.params.locationId));
    await db.delete(locationsTable).where(eq(locationsTable.id, req.params.locationId));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete location" });
  }
});

/* ── GET /locations/:locationId/qr-code-settings  (admin-facing: all dict entries + calibration + enabled) ── */
router.get("/locations/:locationId/qr-code-settings", async (req, res) => {
  try {
    const [loc] = await db
      .select()
      .from(locationsTable)
      .where(eq(locationsTable.id, req.params.locationId));
    if (!loc) { res.status(404).json({ error: "Location not found" }); return; }

    const [dictEntries, qrCodes, settings] = await Promise.all([
      db.select().from(qrDictionaryTable)
        .where(eq(qrDictionaryTable.customerId, loc.customerId))
        .orderBy(qrDictionaryTable.name),
      db.select().from(qrCodesTable)
        .where(eq(qrCodesTable.locationId, req.params.locationId)),
      db.select().from(locationQrCodeSettingsTable)
        .where(eq(locationQrCodeSettingsTable.locationId, req.params.locationId)),
    ]);

    const qrCodeMap = new Map(qrCodes.map((qr) => [qr.qrValue, qr]));
    const settingsMap = new Map(settings.map((s) => [s.qrDictionaryEntryId, s.enabled]));

    res.json({
      locationId: loc.id,
      locationName: loc.name,
      entries: dictEntries.map((entry) => {
        const calibration = qrCodeMap.get(entry.qrValue);
        const enabled = settingsMap.get(entry.id) ?? true;
        return {
          qrDictionaryEntryId: entry.id,
          qrValue: entry.qrValue,
          name: entry.name,
          enabled,
          ...(calibration ? {
            posX: calibration.posX,
            posY: calibration.posY,
            posZ: calibration.posZ,
            rotX: calibration.rotX,
            rotY: calibration.rotY,
            rotZ: calibration.rotZ,
            rotW: calibration.rotW,
            calibratedAt: calibration.calibratedAt.toISOString(),
            ...(calibration.headsetId != null ? { headsetId: calibration.headsetId } : {}),
          } : {}),
        };
      }),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch QR code settings" });
  }
});

/* ── PUT /locations/:locationId/qr-code-settings/:qrDictionaryEntryId ── */
router.put("/locations/:locationId/qr-code-settings/:qrDictionaryEntryId", async (req, res) => {
  try {
    const { enabled } = req.body as { enabled: unknown };
    if (typeof enabled !== "boolean") {
      res.status(400).json({ error: "enabled must be a boolean" }); return;
    }

    const [loc] = await db
      .select()
      .from(locationsTable)
      .where(eq(locationsTable.id, req.params.locationId));
    if (!loc) { res.status(404).json({ error: "Location not found" }); return; }

    const [entry] = await db
      .select()
      .from(qrDictionaryTable)
      .where(and(
        eq(qrDictionaryTable.id, req.params.qrDictionaryEntryId),
        eq(qrDictionaryTable.customerId, loc.customerId),
      ));
    if (!entry) { res.status(404).json({ error: "Dictionary entry not found" }); return; }

    const [setting] = await db
      .insert(locationQrCodeSettingsTable)
      .values({
        id: randomUUID(),
        locationId: req.params.locationId,
        qrDictionaryEntryId: req.params.qrDictionaryEntryId,
        enabled,
      })
      .onConflictDoUpdate({
        target: [locationQrCodeSettingsTable.locationId, locationQrCodeSettingsTable.qrDictionaryEntryId],
        set: { enabled },
      })
      .returning();

    res.json({
      locationId: setting.locationId,
      qrDictionaryEntryId: setting.qrDictionaryEntryId,
      enabled: setting.enabled,
    });
  } catch {
    res.status(500).json({ error: "Failed to update QR code setting" });
  }
});

/* ── GET /locations/:locationId/qr-codes  (headset-facing: only enabled + calibrated) ── */
router.get("/locations/:locationId/qr-codes", async (req, res) => {
  try {
    const [loc] = await db
      .select()
      .from(locationsTable)
      .where(eq(locationsTable.id, req.params.locationId));
    if (!loc) { res.status(404).json({ error: "Location not found" }); return; }

    const [allQrCodes, dictEntries, settings] = await Promise.all([
      db.select().from(qrCodesTable).where(eq(qrCodesTable.locationId, req.params.locationId)),
      db.select().from(qrDictionaryTable).where(eq(qrDictionaryTable.customerId, loc.customerId)),
      db.select().from(locationQrCodeSettingsTable).where(eq(locationQrCodeSettingsTable.locationId, req.params.locationId)),
    ]);

    const dictEntryIdByQrValue = new Map(dictEntries.map((e) => [e.qrValue, e.id]));
    const settingsMap = new Map(settings.map((s) => [s.qrDictionaryEntryId, s.enabled]));

    const qrCodes = allQrCodes.filter((qr) => {
      const entryId = dictEntryIdByQrValue.get(qr.qrValue);
      if (!entryId) return true;
      return settingsMap.get(entryId) ?? true;
    });

    const latest = qrCodes.reduce<{ at: Date | null; headset: string | null }>(
      (acc, r) => (!acc.at || r.calibratedAt > acc.at ? { at: r.calibratedAt, headset: r.headsetId ?? null } : acc),
      { at: null, headset: null },
    );

    res.json({
      headsetId: latest.headset ?? undefined,
      locationId: loc.id,
      locationName: loc.name,
      qrCodes: qrCodes.map((r) => ({
        id: r.id,
        locationId: r.locationId,
        qrValue: r.qrValue,
        posX: r.posX,
        posY: r.posY,
        posZ: r.posZ,
        rotX: r.rotX,
        rotY: r.rotY,
        rotZ: r.rotZ,
        rotW: r.rotW,
        position: { x: r.posX, y: r.posY, z: r.posZ },
        rotation: { x: r.rotX, y: r.rotY, z: r.rotZ, w: r.rotW },
        calibratedAt: r.calibratedAt.toISOString(),
        ...(r.headsetId != null ? { headsetId: r.headsetId } : {}),
      })),
      lastCalibratedAt: latest.at ? latest.at.toISOString() : undefined,
      lastCalibratedByHeadsetId: latest.headset ?? undefined,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch QR codes" });
  }
});

/* ── PUT /locations/:locationId/qr-codes ── */
router.put("/locations/:locationId/qr-codes", async (req, res) => {
  try {
    const parsed = ImportLocationQrCodesBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: String(parsed.error) }); return; }

    const [loc] = await db
      .select()
      .from(locationsTable)
      .where(eq(locationsTable.id, req.params.locationId));
    if (!loc) { res.status(404).json({ error: "Location not found" }); return; }

    const { headsetId, qrCodes } = parsed.data;
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.delete(qrCodesTable).where(eq(qrCodesTable.locationId, req.params.locationId));
      if (qrCodes.length > 0) {
        await tx.insert(qrCodesTable).values(
          qrCodes.map((qr) => ({
            id: randomUUID(),
            locationId: req.params.locationId,
            qrValue: qr.qrValue,
            posX: qr.position.x,
            posY: qr.position.y,
            posZ: qr.position.z,
            rotX: qr.rotation.x,
            rotY: qr.rotation.y,
            rotZ: qr.rotation.z,
            rotW: qr.rotation.w,
            calibratedAt: now,
            headsetId: headsetId ?? null,
          })),
        );
      }
    });

    const inserted = await db
      .select()
      .from(qrCodesTable)
      .where(eq(qrCodesTable.locationId, req.params.locationId));

    res.json({
      locationId: loc.id,
      locationName: loc.name,
      qrCodes: inserted.map((r) => ({
        id: r.id,
        locationId: r.locationId,
        qrValue: r.qrValue,
        posX: r.posX,
        posY: r.posY,
        posZ: r.posZ,
        rotX: r.rotX,
        rotY: r.rotY,
        rotZ: r.rotZ,
        rotW: r.rotW,
        calibratedAt: r.calibratedAt.toISOString(),
        ...(r.headsetId != null ? { headsetId: r.headsetId } : {}),
      })),
      lastCalibratedAt: qrCodes.length > 0 ? now.toISOString() : undefined,
      lastCalibratedByHeadsetId: headsetId ?? undefined,
    });
  } catch {
    res.status(500).json({ error: "Failed to import QR codes" });
  }
});

/* ── POST /locations/:locationId/qr-codes (Unity CalibrationUpload — same logic as PUT) ── */
router.post("/locations/:locationId/qr-codes", async (req, res) => {
  try {
    const parsed = ImportLocationQrCodesBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: String(parsed.error) }); return; }

    const [loc] = await db
      .select()
      .from(locationsTable)
      .where(eq(locationsTable.id, req.params.locationId));
    if (!loc) { res.status(404).json({ error: "Location not found" }); return; }

    const { headsetId, qrCodes } = parsed.data;
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.delete(qrCodesTable).where(eq(qrCodesTable.locationId, req.params.locationId));
      if (qrCodes.length > 0) {
        await tx.insert(qrCodesTable).values(
          qrCodes.map((qr) => ({
            id: randomUUID(),
            locationId: req.params.locationId,
            qrValue: qr.qrValue,
            posX: qr.position.x,
            posY: qr.position.y,
            posZ: qr.position.z,
            rotX: qr.rotation.x,
            rotY: qr.rotation.y,
            rotZ: qr.rotation.z,
            rotW: qr.rotation.w,
            calibratedAt: now,
            headsetId: headsetId ?? null,
          })),
        );
      }
    });

    res.json({ ok: true, locationId: loc.id, count: qrCodes.length });
  } catch {
    res.status(500).json({ error: "Failed to import QR codes" });
  }
});

/* ── DELETE /locations/:locationId/qr-codes ── */
router.delete("/locations/:locationId/qr-codes", async (req, res) => {
  try {
    const [loc] = await db
      .select()
      .from(locationsTable)
      .where(eq(locationsTable.id, req.params.locationId));
    if (!loc) { res.status(404).json({ error: "Location not found" }); return; }

    await db.delete(qrCodesTable).where(eq(qrCodesTable.locationId, req.params.locationId));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to clear QR codes" });
  }
});

export default router;
