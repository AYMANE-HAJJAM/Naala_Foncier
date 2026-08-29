import { Injectable, NotFoundException } from "@nestjs/common";
import { AccessScopeService } from "../../shared/access/access-scope.service.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import type { CreateOppositionDto, UpdateOppositionDto } from "./oppositions.controller.js";

const labels: Record<string, string> = {
  TOTALE: "Totale",
  PARTIELLE: "Partielle",
  DROITS_INDIVIS: "Droits indivis",
  SERVITUDE: "Servitude",
  INSTITUTIONNELLE: "Institutionnelle",
  ISSUE_DU_BORNAGE: "Issue du bornage",
  HORS_DELAI: "Hors délai",
  A_QUALIFIER: "À qualifier",
  OTHER: "Autre",
  CONTESTER: "Contester",
  NEGOCIER: "Négocier",
  ISOLER: "Isoler",
  REGULARISER: "Régulariser",
  ANALYSER: "Analyser",
  DEMANDER_DES_PIECES: "Demander des pièces",
  CRITIQUE: "Critique",
  ELEVE_CRITIQUE: "Élevé / Critique",
  ELEVE: "Élevé",
  MOYEN: "Moyen",
  FAIBLE: "Faible",
  A_CONFIRMER: "À confirmer",
  CRITIQUE_OPERATIONNEL: "Critique opérationnel",
};

@Injectable()
export class OppositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessScopeService,
  ) {}

  private include = {
    responsibleUser: true,
    sourceDocument: { select: { id: true, title: true } },
  } as const;

  private present(o: Awaited<ReturnType<OppositionsService["record"]>>) {
    return {
      id: o.id,
      requisitionId: o.requisitionId,
      number: o.oppositionNumber,
      opponent: o.opponentName,
      type: labels[o.type] ?? o.type,
      scope: o.scope,
      claimedSurface:
        o.claimedSurfaceHectares == null && o.claimedSurfaceAres == null && o.claimedSurfaceCentiares == null
          ? null
          : `${o.claimedSurfaceHectares ?? 0} ha ${o.claimedSurfaceAres ?? 0} a ${o.claimedSurfaceCentiares ?? 0} ca`,
      legalBasis: o.legalBasis,
      description: o.description,
      ancfccStatus: o.ancfccStatus,
      courtStatus: o.courtStatus,
      risk: o.riskLevel ? (labels[o.riskLevel] ?? o.riskLevel) : null,
      strategy: o.strategy ? (labels[o.strategy] ?? o.strategy) : null,
      responsible: o.responsibleUser
        ? `${o.responsibleUser.firstName} ${o.responsibleUser.lastName}`
        : "Non renseigné",
      lastUpdate: o.updatedAt.toISOString().slice(0, 10),
      identityStatus: o.identityStatus,
      referenceDate: o.referenceDate?.toISOString() ?? null,
      impact: o.impact,
      notes: o.notes,
      sourceDocument: o.sourceDocument,
    };
  }

  async record(id: string) {
    const row = await this.prisma.opposition.findFirst({
      where: { id, deletedAt: null },
      include: this.include,
    });
    if (!row) throw new NotFoundException("Opposition introuvable.");
    return row;
  }

  async list(user: AuthUser, requisitionId?: string) {
    if (requisitionId) await this.access.assertCanAccessRequisition(user, requisitionId);
    const idFilter = requisitionId ? undefined : await this.access.requisitionIdFilter(user);
    return (
      await this.prisma.opposition.findMany({
        where: {
          deletedAt: null,
          ...(requisitionId ? { requisitionId } : idFilter ? { requisitionId: idFilter } : {}),
        },
        include: this.include,
        orderBy: [{ requisitionId: "asc" }, { oppositionNumber: "asc" }],
      })
    ).map((o) => this.present(o));
  }

  async get(id: string, user: AuthUser) {
    const row = await this.record(id);
    await this.access.assertCanAccessRequisition(user, row.requisitionId);
    return this.present(row);
  }

  async create(dto: CreateOppositionDto, actor: AuthUser) {
    await this.access.assertCanAccessRequisition(actor, dto.requisitionId);
    const row = await this.prisma.$transaction(async (tx) => {
      const value = await tx.opposition.create({
        data: { ...dto, referenceDate: dto.referenceDate ? new Date(dto.referenceDate) : undefined },
        include: this.include,
      });
      await tx.auditLog.create({
        data: { actorUserId: actor.id, action: "OPPOSITION_CREATED", entityType: "Opposition", entityId: value.id, metadata: { requisitionId: value.requisitionId } },
      });
      await tx.terrainEvent.create({ data: { requisitionId: value.requisitionId, type: "OPPOSITION_ADDED", occurredAt: value.referenceDate ?? new Date(), title: value.oppositionNumber ? `Opposition n° ${value.oppositionNumber} ajoutée` : "Opposition ajoutée", source: "MANUAL", createdByUserId: actor.id, validatedByUserId: actor.id, validationStatus: "CONFIRMED", payloadJson: { oppositionId: value.id } } });
      return value;
    });
    return this.present(row);
  }

  async update(id: string, dto: UpdateOppositionDto, actor: AuthUser) {
    const previous = await this.record(id);
    await this.access.assertCanAccessRequisition(actor, previous.requisitionId);
    if (dto.requisitionId) await this.access.assertCanAccessRequisition(actor, dto.requisitionId);
    const row = await this.prisma.$transaction(async (tx) => {
      const value = await tx.opposition.update({
        where: { id },
        data: { ...dto, referenceDate: dto.referenceDate ? new Date(dto.referenceDate) : undefined },
        include: this.include,
      });
      await tx.auditLog.create({
        data: { actorUserId: actor.id, action: "OPPOSITION_UPDATED", entityType: "Opposition", entityId: id, metadata: { requisitionId: value.requisitionId } },
      });
      await tx.terrainEvent.create({ data: { requisitionId: value.requisitionId, type: "OPPOSITION_UPDATED", occurredAt: new Date(), title: value.oppositionNumber ? `Opposition n° ${value.oppositionNumber} mise à jour` : "Opposition mise à jour", source: "MANUAL", createdByUserId: actor.id, validatedByUserId: actor.id, validationStatus: "CONFIRMED", payloadJson: { oppositionId: value.id } } });
      return value;
    });
    return this.present(row);
  }

  async remove(id: string, actor: AuthUser) {
    const previous = await this.record(id);
    await this.access.assertCanAccessRequisition(actor, previous.requisitionId);
    await this.prisma.$transaction([
      this.prisma.opposition.update({ where: { id }, data: { deletedAt: new Date() } }),
      this.prisma.auditLog.create({
        data: { actorUserId: actor.id, action: "OPPOSITION_DELETED", entityType: "Opposition", entityId: id, metadata: { requisitionId: previous.requisitionId } },
      }),
    ]);
  }
}
