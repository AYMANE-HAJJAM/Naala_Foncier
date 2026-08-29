import { Injectable, NotFoundException } from "@nestjs/common";
import { AccessScopeService } from "../../shared/access/access-scope.service.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { presentAction } from "../shared/presenters.js";
import type { CreateActionDto, UpdateActionDto } from "./actions.controller.js";

@Injectable()
export class ActionsService {
  constructor(
    private readonly p: PrismaService,
    private readonly access: AccessScopeService,
  ) {}

  private include = { responsibleUser: true, requisition: true } as const;

  async record(id: string) {
    const a = await this.p.actionItem.findFirst({
      where: { id, deletedAt: null },
      include: this.include,
    });
    if (!a) throw new NotFoundException("Action introuvable.");
    return a;
  }

  private async assertActionAccess(user: AuthUser, id: string) {
    const action = await this.record(id);
    await this.access.assertCanAccessOptionalRequisition(user, action.requisitionId);
    return action;
  }

  async list(user: AuthUser, req?: string) {
    if (req) await this.access.assertCanAccessRequisition(user, req);
    const idFilter = req ? undefined : await this.access.requisitionIdFilter(user);
    return (
      await this.p.actionItem.findMany({
        where: {
          deletedAt: null,
          ...(req ? { requisitionId: req } : idFilter ? { requisitionId: idFilter } : {}),
        },
        include: this.include,
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      })
    ).map(presentAction);
  }

  async get(id: string, user: AuthUser) {
    return presentAction(await this.assertActionAccess(user, id));
  }

  async create(d: CreateActionDto, user: AuthUser) {
    await this.access.assertCanAccessOptionalRequisition(user, d.requisitionId);
    const a = await this.p.$transaction(async (tx) => {
      const v = await tx.actionItem.create({
        data: { ...d, dueDate: d.dueDate ? new Date(d.dueDate) : undefined, createdById: user.id },
        include: this.include,
      });
      await tx.auditLog.create({
        data: { actorUserId: user.id, action: "ACTION_CREATED", entityType: "ActionItem", entityId: v.id },
      });
      return v;
    });
    return presentAction(a);
  }

  async update(id: string, d: UpdateActionDto, user: AuthUser) {
    const old = await this.assertActionAccess(user, id);
    if (d.requisitionId !== undefined) {
      await this.access.assertCanAccessOptionalRequisition(user, d.requisitionId);
    }
    const completed = d.status === "TERMINEE" && old.status !== "TERMINEE";
    const a = await this.p.$transaction(async (tx) => {
      const v = await tx.actionItem.update({
        where: { id },
        data: {
          ...d,
          dueDate: d.dueDate ? new Date(d.dueDate) : undefined,
          ...(completed ? { completedAt: new Date(), progress: 100 } : {}),
        },
        include: this.include,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: completed ? "ACTION_COMPLETED" : "ACTION_UPDATED",
          entityType: "ActionItem",
          entityId: id,
          oldValues: { status: old.status },
          newValues: { status: v.status },
        },
      });
      return v;
    });
    return presentAction(a);
  }

  async remove(id: string, user: AuthUser) {
    await this.assertActionAccess(user, id);
    await this.p.actionItem.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async comments(id: string, user: AuthUser) {
    await this.assertActionAccess(user, id);
    return this.p.actionComment.findMany({
      where: { actionItemId: id },
      include: { author: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async comment(id: string, content: string, user: AuthUser) {
    await this.assertActionAccess(user, id);
    return this.p.actionComment.create({
      data: { actionItemId: id, content, authorId: user.id },
      include: { author: { select: { firstName: true, lastName: true } } },
    });
  }
}
