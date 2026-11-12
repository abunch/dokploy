import type { AuditAction, AuditResourceType } from "@dokploy/server/db/schema";
import { writeAuditLog } from "@dokploy/server/services/fork/org";

interface AuditCtx {
	user: { id: string; email: string; role: string };
	session: { activeOrganizationId: string };
}

interface AuditEvent {
	action: AuditAction;
	resourceType: AuditResourceType;
	resourceId?: string;
	resourceName?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Creates an audit log entry from a tRPC context.
 * Extracts userId, userEmail, userRole and organizationId automatically.
 *
 * Usage:
 *   await audit(ctx, { action: "create", resourceType: "project", resourceName: "my-app" });
 */
export const audit = (ctx: AuditCtx, event: AuditEvent) =>
	writeAuditLog({
		organizationId: ctx.session.activeOrganizationId,
		userId: ctx.user.id,
		userEmail: ctx.user.email,
		userRole: ctx.user.role,
		...event,
	});
