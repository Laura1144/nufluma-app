import { db } from "./db";
import { AuditAction } from "@prisma/client";

interface AuditParams {
  workspaceId?: string;
  userId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(params: AuditParams) {
  try {
    await db.auditLog.create({ data: params as Parameters<typeof db.auditLog.create>[0]["data"] });
  } catch (err) {
    // Audit log failure should never break the main flow
    console.error("[AUDIT] Failed to create audit log", {
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
