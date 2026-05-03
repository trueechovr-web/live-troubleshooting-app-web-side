import { Router } from "express";
import { db } from "@workspace/db";
import { headsetsTable, customersTable, locationsTable, qrCodesTable, qrDictionaryTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

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

    const [qrCodes, dictionary] = await Promise.all([
      db.select().from(qrCodesTable).where(eq(qrCodesTable.locationId, locationId)),
      db.select().from(qrDictionaryTable).where(eq(qrDictionaryTable.customerId, headset.customerId)),
    ]);

    const nameMap = new Map(dictionary.map((d) => [d.qrValue, d.name]));

    res.json({
      locationId: location.id,
      locationName: location.name,
      qrCodes: qrCodes.map((r) => {
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
