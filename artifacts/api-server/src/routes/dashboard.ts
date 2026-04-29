import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, headsetsTable, sessionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/dashboard/summary", async (_req, res) => {
  try {
    const customers = await db.select().from(customersTable);
    const headsets = await db.select().from(headsetsTable);
    const activeSessions = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.status, "active"));

    const byStatus = {
      active: customers.filter((c) => c.status === "active").length,
      inactive: customers.filter((c) => c.status === "inactive").length,
      trial: customers.filter((c) => c.status === "trial").length,
    };

    res.json({
      totalCustomers: customers.length,
      totalHeadsets: headsets.length,
      activeHeadsets: headsets.filter((h) => h.status === "online").length,
      activeSessions: activeSessions.length,
      customersByStatus: byStatus,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

export default router;
