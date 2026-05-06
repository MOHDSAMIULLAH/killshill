import { db } from '../db/pool';
import { signals } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

export type Signal = InferSelectModel<typeof signals>;

export type NewSignal = Pick<
  InferInsertModel<typeof signals>,
  'symbol' | 'direction' | 'entry_price' | 'stop_loss' | 'target_price' | 'entry_time' | 'expiry_time'
>;

export const signalModel = {
  async create(data: NewSignal): Promise<Signal> {
    const result = await db
      .insert(signals)
      .values(data)
      .returning();
    return result[0];
  },

  async findAll(): Promise<Signal[]> {
    return db.select().from(signals).orderBy(desc(signals.created_at));
  },

  async findById(id: number): Promise<Signal | null> {
    const result = await db.select().from(signals).where(eq(signals.id, id));
    return result[0] ?? null;
  },

  async updateStatus(
    id: number,
    status: Signal['status'],
    realized_roi: number | null = null
  ): Promise<Signal> {
    const result = await db
      .update(signals)
      .set({ status, realized_roi: realized_roi !== null ? String(realized_roi) : null })
      .where(eq(signals.id, id))
      .returning();
    return result[0];
  },

  async remove(id: number): Promise<Signal | null> {
    const result = await db.delete(signals).where(eq(signals.id, id)).returning();
    return result[0] ?? null;
  },
};
