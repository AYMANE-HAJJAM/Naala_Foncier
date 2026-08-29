import { ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthUser } from "../authentication/auth-user.js";
import { PrismaService } from "../database/prisma.service.js";

@Injectable()
export class AccessScopeService {
  constructor(private readonly prisma: PrismaService) {}

  isAdmin(user: AuthUser): boolean {
    return user.roles.includes("ADMIN");
  }

  async assignedRequisitionIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRequisitionAccess.findMany({
      where: { userId },
      select: { requisitionId: true },
    });
    return rows.map((row) => row.requisitionId);
  }

  /** Prisma filter fragment for requisition.id when the user is not ADMIN. */
  async requisitionIdFilter(user: AuthUser): Promise<{ in: string[] } | undefined> {
    if (this.isAdmin(user)) return undefined;
    return { in: await this.assignedRequisitionIds(user.id) };
  }

  async assertCanAccessRequisition(user: AuthUser, requisitionId: string): Promise<void> {
    if (this.isAdmin(user)) return;
    const access = await this.prisma.userRequisitionAccess.findUnique({
      where: { userId_requisitionId: { userId: user.id, requisitionId } },
    });
    if (!access) {
      throw new ForbiddenException({
        code: "REQUISITION_ACCESS_DENIED",
        message: "Accès non autorisé à cette réquisition.",
      });
    }
  }

  async assertCanAccessOptionalRequisition(
    user: AuthUser,
    requisitionId: string | null | undefined,
  ): Promise<void> {
    if (!requisitionId) {
      if (!this.isAdmin(user)) {
        throw new ForbiddenException({
          code: "REQUISITION_ACCESS_DENIED",
          message: "Accès non autorisé à cette ressource.",
        });
      }
      return;
    }
    await this.assertCanAccessRequisition(user, requisitionId);
  }
}
