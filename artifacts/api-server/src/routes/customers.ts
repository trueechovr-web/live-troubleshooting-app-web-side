import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, insertCustomerSchema } from "@workspace/db";
import { UpdateCustomerPointToObjectsBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

router.get("/customers", async (_req, res) => {
  try {
    const customers = await db.select().from(customersTable).orderBy(customersTable.createdAt);
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

router.post("/customers", async (req, res) => {
  try {
    const parsed = insertCustomerSchema.safeParse({ ...req.body, id: randomUUID() });
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [customer] = await db.insert(customersTable).values(parsed.data).returning();
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ error: "Failed to create customer" });
  }
});

router.get("/customers/:customerId", async (req, res) => {
  try {
    const [customer] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, req.params.customerId));
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

router.put("/customers/:customerId/point-to-objects", async (req, res) => {
  try {
    const parsed = UpdateCustomerPointToObjectsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [updated] = await db
      .update(customersTable)
      .set({ pointToObjects: parsed.data })
      .where(eq(customersTable.id, req.params.customerId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update point-to objects" });
  }
});

export default router;
