import { ssoSettingsInputSchema } from "@dokploy/server/db/schema";
import {
	countSsoProviders,
	createSsoProvider,
	deleteSsoProvider,
	listSsoProviders,
	updateSsoProvider,
} from "@dokploy/server/services/fork/sso-providers";
import {
	getWebServerSettings,
	updateWebServerSettings,
} from "@dokploy/server/services/web-server-settings";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { audit } from "@/server/api/utils/audit";
import { adminProcedure, createTRPCRouter, protectedProcedure } from "../trpc";

const providerIdSchema = z
	.string()
	.trim()
	.min(2)
	.max(64)
	.regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, numbers and dashes");

const domainsSchema = z.array(z.string().trim().min(1)).min(1).max(20);

const toHeaders = (raw: Record<string, string | string[] | undefined>) => {
	const headers = new Headers();
	for (const [key, value] of Object.entries(raw)) {
		if (Array.isArray(value)) {
			for (const item of value) headers.append(key, item);
		} else if (value !== undefined) {
			headers.set(key, value);
		}
	}
	return headers;
};

export const forkSsoRouter = createTRPCRouter({
	listProviders: adminProcedure.query(({ ctx }) =>
		listSsoProviders(ctx.session.activeOrganizationId),
	),

	createProvider: adminProcedure
		.input(
			z.object({
				providerId: providerIdSchema,
				issuer: z.string().url(),
				clientId: z.string().trim().min(1),
				clientSecret: z.string().min(1),
				domains: domainsSchema,
				settings: ssoSettingsInputSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await createSsoProvider({
				organizationId: ctx.session.activeOrganizationId,
				headers: toHeaders(ctx.req.headers),
				input,
			});
			await audit(ctx, {
				action: "create",
				resourceType: "security",
				resourceId: input.providerId,
				resourceName: `SSO provider ${input.issuer}`,
				metadata: { domains: input.domains, settings: input.settings },
			});
			return true;
		}),

	updateProvider: adminProcedure
		.input(
			z.object({
				providerId: providerIdSchema,
				clientId: z.string().trim().min(1).optional(),
				clientSecret: z.string().optional(),
				domains: domainsSchema.optional(),
				settings: ssoSettingsInputSchema.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await updateSsoProvider({
				organizationId: ctx.session.activeOrganizationId,
				headers: toHeaders(ctx.req.headers),
				input: { ...input, clientSecret: input.clientSecret || undefined },
			});
			await audit(ctx, {
				action: "update",
				resourceType: "security",
				resourceId: input.providerId,
				resourceName: "SSO provider",
				metadata: {
					domains: input.domains,
					settings: input.settings,
					secretChanged: Boolean(input.clientSecret),
				},
			});
			return true;
		}),

	deleteProvider: adminProcedure
		.input(z.object({ providerId: providerIdSchema }))
		.mutation(async ({ ctx, input }) => {
			const settings = await getWebServerSettings();
			if (settings?.enforceSSO && (await countSsoProviders()) <= 1) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Turn off SSO-only before deleting the last SSO provider",
				});
			}
			await deleteSsoProvider({
				organizationId: ctx.session.activeOrganizationId,
				providerId: input.providerId,
			});
			await audit(ctx, {
				action: "delete",
				resourceType: "security",
				resourceId: input.providerId,
				resourceName: "SSO provider",
			});
			return true;
		}),

	getSsoOnly: protectedProcedure.query(async () => {
		const settings = await getWebServerSettings();
		return settings?.enforceSSO ?? false;
	}),

	setSsoOnly: protectedProcedure
		.input(z.object({ enabled: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			if (ctx.user.role !== "owner") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only the organization owner can change SSO-only mode",
				});
			}
			if (input.enabled && (await countSsoProviders()) === 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Add an SSO provider before requiring SSO",
				});
			}
			await updateWebServerSettings({ enforceSSO: input.enabled });
			await audit(ctx, {
				action: "update",
				resourceType: "security",
				resourceName: input.enabled ? "SSO-only enabled" : "SSO-only disabled",
			});
			return input.enabled;
		}),
});
