import { Router } from "express";
import { db } from "@workspace/db";
import { headsetsTable, customersTable } from "@workspace/db";
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

export default router;
