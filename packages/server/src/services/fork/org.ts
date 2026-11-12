import { db } from "@dokploy/server/db";
import {
	type AuditAction,
	type AuditResourceType,
	auditLog,
	organization,
	organizationRole,
} from "@dokploy/server/db/schema";
import { and, eq } from "drizzle-orm";

const builtInRoles = new Set(["owner", "admin", "member"]);

export const getOrganizationOwnerId = async (
	organizationId: string,
): Promise<string | null> => {
	const org = await db.query.organization.findFirst({
		where: eq(organization.id, organizationId),
		columns: { ownerId: true },
	});
	return org?.ownerId ?? null;
};

export const getOrganizationDefaultRole = async (
	organizationId: string,
): Promise<string> => {
	const org = await db.query.organization.findFirst({
		where: eq(organization.id, organizationId),
		columns: { defaultRole: true },
	});
	const role = org?.defaultRole;
	if (!role || role === "owner") return "member";
	if (builtInRoles.has(role)) return role;

	const customRole = await db.query.organizationRole.findFirst({
		where: and(
			eq(organizationRole.organizationId, organizationId),
			eq(organizationRole.role, role),
		),
		columns: { id: true },
	});
	return customRole ? role : "member";
};

export interface AuditLogEntry {
	organizationId: string;
	userId: string;
	userEmail: string;
	userRole: string;
	action: AuditAction;
	resourceType: AuditResourceType;
	resourceId?: string;
	resourceName?: string;
	metadata?: Record<string, unknown>;
}

// Audit writes are best-effort: a failed insert must never fail the action being audited.
export const writeAuditLog = async (entry: AuditLogEntry): Promise<void> => {
	try {
		await db.insert(auditLog).values({
			...entry,
			metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
		});
	} catch (error) {
		console.error("Failed to write audit log entry", error);
	}
};
