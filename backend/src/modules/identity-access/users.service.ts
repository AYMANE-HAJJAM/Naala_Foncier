import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { hash } from "bcryptjs";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import type { CreateRoleDto, CreateUserDto, UpdateRoleDto, UpdateUserDto } from "./dto/user.dto.js";

const ACTIVE_ROLE_KEYS = new Set(["ADMIN", "USER"]);

function presentUser(user: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  roles: { role: { key: string; name: string } }[];
}) {
  const primary = user.roles[0]?.role;
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`.trim(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    initials: `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "NF",
    role: primary?.name ?? "Utilisateur",
    roleKey: primary?.key ?? "USER",
    status: user.isActive ? ("Actif" as const) : ("Désactivé" as const),
    isActive: user.isActive,
    roles: user.roles.map((r) => r.role.key),
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private include = {
    roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
  } as const;

  async list() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      include: this.include,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    return users.map(presentUser);
  }

  async get(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: this.include,
    });
    if (!user) throw new NotFoundException("Utilisateur introuvable.");
    return presentUser(user);
  }

  async create(dto: CreateUserDto, actorId: string) {
    if (await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } })) {
      throw new ConflictException({
        code: "EMAIL_ALREADY_EXISTS",
        message: "Cette adresse e-mail est déjà utilisée.",
      });
    }
    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email.toLowerCase(),
        passwordHash: await hash(dto.password, 12),
        roles: { create: dto.roleIds.map((roleId) => ({ roleId })) },
      },
      include: this.include,
    });
    await this.audit.write({
      actorUserId: actorId,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
    });
    return presentUser(user);
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const previous = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: this.include,
    });
    if (!previous) throw new NotFoundException("Utilisateur introuvable.");
    const { roleIds, password, ...data } = dto;
    const user = await this.prisma.$transaction(async (tx) => {
      if (roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({ userId: id, roleId })),
        });
      }
      return tx.user.update({
        where: { id },
        data: {
          ...data,
          ...(password ? { passwordHash: await hash(password, 12) } : {}),
        },
        include: this.include,
      });
    });
    await this.audit.write({
      actorUserId: actorId,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: id,
      oldValues: { email: previous.email, isActive: previous.isActive },
      newValues: { email: user.email, isActive: user.isActive },
    });
    return presentUser(user);
  }

  setActive(id: string, isActive: boolean, actorId: string) {
    return this.update(id, { isActive }, actorId);
  }

  roles() {
    return this.prisma.role.findMany({
      where: { key: { in: [...ACTIVE_ROLE_KEYS] } },
      include: { permissions: { include: { permission: true } } },
      orderBy: { key: "asc" },
    });
  }

  permissions() {
    return this.prisma.permission.findMany({ orderBy: { key: "asc" } });
  }

  createRole(dto: CreateRoleDto, actorId: string) {
    return this.prisma.role
      .create({
        data: {
          key: dto.key,
          name: dto.name,
          description: dto.description,
          permissions: { create: dto.permissionIds.map((permissionId) => ({ permissionId })) },
        },
        include: { permissions: { include: { permission: true } } },
      })
      .then(async (role) => {
        await this.audit.write({
          actorUserId: actorId,
          action: "ROLE_CREATED",
          entityType: "Role",
          entityId: role.id,
        });
        return role;
      });
  }

  async updateRole(id: string, dto: UpdateRoleDto, actorId: string) {
    const { permissionIds, ...data } = dto;
    const role = await this.prisma.$transaction(async (tx) => {
      if (permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
        });
      }
      return tx.role.update({
        where: { id },
        data,
        include: { permissions: { include: { permission: true } } },
      });
    });
    await this.audit.write({
      actorUserId: actorId,
      action: "ROLE_UPDATED",
      entityType: "Role",
      entityId: id,
    });
    return role;
  }
}
