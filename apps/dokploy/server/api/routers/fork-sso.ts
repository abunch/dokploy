import { ssoSettingsInputSchema } from "@dokploy/server/db/schema";
import {
	countActiveSsoProviders,
	createSsoProvider,
	deleteSsoProvider,
	isProviderEnabled,
	listSsoProviders,
	setSsoProviderActive,
	updateSsoProvider,
} from "@dokploy/server/services/fork/sso-providers";
import {
	getWebServerSettings,
	updateWebServerSettings,
} from "@dokploy/server/services/web-server-settings";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { audit } from "@/server/api/utils/audit";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const providerIdSchema = z
	.string()
	.trim()
	.min(2)
	.max(64)
	.regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, numbers and dashes");

const domainsSchema = z.array(z.string().trim().min(1)).min(1).max(20);

// Providers decide who can sign in as which account, so only owners manage them.
const ownerProcedure = protectedProcedure.use(({ ctx, next }) => {
	if (ctx.user.role !== "owner") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Only the organization owner can manage single sign-on",
		});
	}
	return next();
});

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
	listProviders: ownerProcedure.query(({ ctx }) =>
		listSsoProviders(ctx.session.activeOrganizationId),
	),

	createProvider: ownerProcedure
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
			const { enabled } = await createSsoProvider({
				organizationId: ctx.session.activeOrganizationId,
				headers: toHeaders(ctx.req.headers),
				input,
			});
			await audit(ctx, {
				action: "create",
				resourceType: "security",
				resourceId: input.providerId,
				resourceName: `SSO provider ${input.issuer}`,
				metadata: { domains: input.domains, settings: input.settings, enabled },
			});
			return { enabled };
		}),

	updateProvider: ownerProcedure
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

	deleteProvider: ownerProcedure
		.input(z.object({ providerId: providerIdSchema }))
		.mutation(async ({ ctx, input }) => {
			const settings = await getWebServerSettings();
			if (
				settings?.enforceSSO &&
				(await isProviderEnabled(input.providerId)) &&
				(await countActiveSsoProviders()) <= 1
			) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Turn off Require SSO before deleting the last active SSO provider",
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

	setProviderActive: ownerProcedure
		.input(z.object({ providerId: providerIdSchema, active: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			const settings = await getWebServerSettings();
			const result = await setSsoProviderActive({
				organizationId: ctx.session.activeOrganizationId,
				providerId: input.providerId,
				active: input.active,
				ssoRequired: settings?.enforceSSO ?? false,
			});
			await audit(ctx, {
				action: "update",
				resourceType: "security",
				resourceId: input.providerId,
				resourceName: input.active
					? "SSO provider activated"
					: "SSO provider deactivated",
				metadata: { deactivated: result.deactivated },
			});
			return result;
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
			if (input.enabled && (await countActiveSsoProviders()) === 0) {
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
