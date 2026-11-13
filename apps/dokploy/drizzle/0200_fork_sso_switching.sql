ALTER TABLE "fork_sso_settings" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "fork_sso_settings" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;