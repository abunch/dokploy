CREATE TABLE "fork_sso_settings" (
	"provider_id" text PRIMARY KEY NOT NULL,
	"display_name" text,
	"groups_claim" text DEFAULT 'groups' NOT NULL,
	"role_mappings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_role" text DEFAULT 'member' NOT NULL,
	"require_mapped_group" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webServerSettings" ALTER COLUMN "whitelabelingConfig" SET DEFAULT '{"appName":null,"appDescription":null,"logoUrl":null,"faviconUrl":null,"customCss":null,"loginLogoUrl":null,"supportUrl":null,"docsUrl":null,"errorPageTitle":null,"errorPageDescription":null,"footerText":null,"ogImageUrl":null,"passwordResetGuide":null,"supportEmail":null,"logoLightUrl":null,"loginLogoLightUrl":null,"faviconLightUrl":null,"dualModeBranding":false}'::jsonb;--> statement-breakpoint
ALTER TABLE "fork_sso_settings" ADD CONSTRAINT "fork_sso_settings_provider_id_sso_provider_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."sso_provider"("provider_id") ON DELETE cascade ON UPDATE no action;