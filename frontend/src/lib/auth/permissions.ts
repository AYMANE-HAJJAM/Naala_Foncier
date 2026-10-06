import type { SessionUser } from "../api/auth-session";

export type UiCapabilities = {
  canCreateTerrain: boolean;
  canUploadDocument: boolean;
  canManageJudicial: boolean;
  canReviewAI: boolean;
  canManageUsers: boolean;
};

export function hasPermission(user: SessionUser | null, permission: string): boolean {
  return Boolean(user?.permissions.includes(permission));
}

export function uiCapabilities(user: SessionUser | null): UiCapabilities {
  return {
    canCreateTerrain: hasPermission(user, "requisition.create"),
    canUploadDocument: hasPermission(user, "document.upload"),
    canManageJudicial: hasPermission(user, "legalCase.manage"),
    canReviewAI: hasPermission(user, "aiAnalysis.validate"),
    canManageUsers: hasPermission(user, "user.manage"),
  };
}
