import { Router } from "express";
import { db } from "@workspace/db";
import { qrDictionaryTable, customersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { CreateQrDictionaryEntryBody } from "@workspace/api-zod";

const router = Router();

/* ── GET /customers/:customerId/qr-dictionary ── */
router.get("/customers/:customerId/qr-dictionary", async (req, res) => {
  try {
    const [customer] = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(eq(customersTable.id, req.params.customerId));
    if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }

    const entries = await db
      .select()
      .from(qrDictionaryTable)
      .where(eq(qrDictionaryTable.customerId, req.params.customerId))
      .orderBy(qrDictionaryTable.updatedAt);

    res.json(entries.map((e) => ({ ...e, updatedAt: e.updatedAt.toISOString() })));
  } catch {
    res.status(500).json({ error: "Failed to fetch QR dictionary" });
  }
});

/* ── POST /customers/:customerId/qr-dictionary ── */
router.post("/customers/:customerId/qr-dictionary", async (req, res) => {
  try {
    const parsed = CreateQrDictionaryEntryBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: String(parsed.error) }); return; }

    const [customer] = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(eq(customersTable.id, req.params.customerId));
    if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }

    const [entry] = await db
      .insert(qrDictionaryTable)
      .values({
        id: randomUUID(),
        customerId: req.params.customerId,
        qrValue: parsed.data.qrValue,
        name: parsed.data.name,
        updatedAt: new Date(),
      })
      .returning();

    res.status(201).json({ ...entry, updatedAt: entry.updatedAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to create QR dictionary entry" });
  }
});

/* ── PUT /customers/:customerId/qr-dictionary/:entryId ── */
router.put("/customers/:customerId/qr-dictionary/:entryId", async (req, res) => {
  try {
    const parsed = CreateQrDictionaryEntryBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: String(parsed.error) }); return; }

    const [entry] = await db
      .update(qrDictionaryTable)
      .set({ qrValue: parsed.data.qrValue, name: parsed.data.name, updatedAt: new Date() })
      .where(
        and(
          eq(qrDictionaryTable.id, req.params.entryId),
          eq(qrDictionaryTable.customerId, req.params.customerId),
        ),
      )
      .returning();

    if (!entry) { res.status(404).json({ error: "Entry not found" }); return; }
    res.json({ ...entry, updatedAt: entry.updatedAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to update QR dictionary entry" });
  }
});

/* ── DELETE /customers/:customerId/qr-dictionary/:entryId ── */
router.delete("/customers/:customerId/qr-dictionary/:entryId", async (req, res) => {
  try {
    const [entry] = await db
      .delete(qrDictionaryTable)
      .where(
        and(
          eq(qrDictionaryTable.id, req.params.entryId),
          eq(qrDictionaryTable.customerId, req.params.customerId),
        ),
      )
      .returning();

    if (!entry) { res.status(404).json({ error: "Entry not found" }); return; }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete QR dictionary entry" });
  }
});

export default router;
