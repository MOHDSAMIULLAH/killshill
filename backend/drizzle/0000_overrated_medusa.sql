CREATE TYPE "public"."signal_direction" AS ENUM('BUY', 'SELL');--> statement-breakpoint
CREATE TYPE "public"."signal_status" AS ENUM('OPEN', 'TARGET_HIT', 'STOPLOSS_HIT', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"direction" "signal_direction" NOT NULL,
	"entry_price" numeric(20, 8) NOT NULL,
	"stop_loss" numeric(20, 8) NOT NULL,
	"target_price" numeric(20, 8) NOT NULL,
	"entry_time" timestamp with time zone NOT NULL,
	"expiry_time" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "signal_status" DEFAULT 'OPEN' NOT NULL,
	"realized_roi" numeric(10, 4)
);
