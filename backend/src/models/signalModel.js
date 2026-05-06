const { db } = require('../db/pool');
const { signals } = require('../db/schema');
const { eq, desc } = require('drizzle-orm');

const signalModel = {
  async create({ symbol, direction, entry_price, stop_loss, target_price, entry_time, expiry_time }) {
    const result = await db
      .insert(signals)
      .values({ symbol, direction, entry_price, stop_loss, target_price, entry_time, expiry_time })
      .returning();
    return result[0];
  },

  async findAll() {
    return db.select().from(signals).orderBy(desc(signals.created_at));
  },

  async findById(id) {
    const result = await db.select().from(signals).where(eq(signals.id, id));
    return result[0] || null;
  },

  async updateStatus(id, status, realized_roi = null) {
    const result = await db
      .update(signals)
      .set({ status, realized_roi })
      .where(eq(signals.id, id))
      .returning();
    return result[0];
  },

  async remove(id) {
    const result = await db.delete(signals).where(eq(signals.id, id)).returning();
    return result[0] || null;
  },
};

module.exports = signalModel;
