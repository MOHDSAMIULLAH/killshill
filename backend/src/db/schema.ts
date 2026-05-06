import { pgTable, serial, varchar, decimal, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const directionEnum = pgEnum('signal_direction', ['BUY', 'SELL']);
export const statusEnum = pgEnum('signal_status', ['OPEN', 'TARGET_HIT', 'STOPLOSS_HIT', 'EXPIRED']);

export const signals = pgTable('signals', {
  id:           serial('id').primaryKey(),
  symbol:       varchar('symbol', { length: 20 }).notNull(),
  direction:    directionEnum('direction').notNull(),
  entry_price:  decimal('entry_price',  { precision: 20, scale: 8 }).notNull(),
  stop_loss:    decimal('stop_loss',    { precision: 20, scale: 8 }).notNull(),
  target_price: decimal('target_price', { precision: 20, scale: 8 }).notNull(),
  entry_time:   timestamp('entry_time',  { withTimezone: true }).notNull(),
  expiry_time:  timestamp('expiry_time', { withTimezone: true }).notNull(),
  created_at:   timestamp('created_at',  { withTimezone: true }).defaultNow().notNull(),
  status:       statusEnum('status').default('OPEN').notNull(),
  realized_roi: decimal('realized_roi', { precision: 10, scale: 4 }),
});
