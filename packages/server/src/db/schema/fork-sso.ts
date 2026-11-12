import { relations } from "drizzle-orm";
import { boolean, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { z } from "zod";
import { ssoProvider } from "./sso";

export const ssoMappedRoles = ["admin", "member"] as const;
export type SsoMappedRole = (typeof ssoMappedRoles)[number];

export interface SsoRoleMapping {
	group: string;
	role: SsoMappedRole;
}

export const forkSsoSettings = pgTable("fork_sso_settings", {
	providerId: text("provider_id")
		.primaryKey()
		.references(() => ssoProvider.providerId, { onDelete: "cascade" }),
	groupsClaim: text("groups_claim").notNull().default("groups"),
	roleMappings: jsonb("role_mappings")
		.$type<SsoRoleMapping[]>()
		.notNull()
		.default([]),
	defaultRole: text("default_role")
		.$type<SsoMappedRole>()
		.notNull()
		.default("member"),
	requireMappedGroup: boolean("require_mapped_group").notNull().default(false),
});

export const forkSsoSettingsRelations = relations(
	forkSsoSettings,
	({ one }) => ({
		provider: one(ssoProvider, {
			fields: [forkSsoSettings.providerId],
			references: [ssoProvider.providerId],
		}),
	}),
);

export const ssoSettingsInputSchema = z.object({
	groupsClaim: z.string().trim().min(1).max(100).default("groups"),
	roleMappings: z
		.array(
			z.object({
				group: z.string().trim().min(1).max(200),
				role: z.enum(ssoMappedRoles),
			}),
		)
		.max(100)
		.default([]),
	defaultRole: z.enum(ssoMappedRoles).default("member"),
	requireMappedGroup: z.boolean().default(false),
});

export type SsoSettingsInput = z.infer<typeof ssoSettingsInputSchema>;
