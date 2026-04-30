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

    const [qrCodes, dictionary] = await Promise.all([
      db.select().from(qrCodesTable).where(eq(qrCodesTable.locationId, locationId)),
      db.select().from(qrDictionaryTable).where(eq(qrDictionaryTable.customerId, headset.customerId)),
    ]);

    const nameMap = new Map(dictionary.map((d) => [d.qrValue, d.name]));

    res.json({
      locationId: location.id,
      locationName: location.name,
      qrCodes: qrCodes.map((r) => ({
        qrValue: r.qrValue,
        name: nameMap.get(r.qrValue) ?? null,
        posX: r.posX,
        posY: r.posY,
        posZ: r.posZ,
        rotX: r.rotX,
        rotY: r.rotY,
        rotZ: r.rotZ,
        rotW: r.rotW,
      })),
      nameDictionary: dictionary.map((d) => ({ qrValue: d.qrValue, name: d.name })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch startup data" });
  }
});

export default router;
