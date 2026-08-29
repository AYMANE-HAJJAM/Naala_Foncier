import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { toPrismaJsonObject } from "../../shared/database/prisma-json.js";
import { AccessScopeService } from "../../shared/access/access-scope.service.js";
import { AuditService } from "../audit/audit.service.js";
import { StatusSnapshotService } from "../events/status-snapshot.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import type { TerrainEventType } from "../../generated/prisma/enums.js";

type ProposalPayload = {
  proposalType?: string;
  title?: string;
  summary?: string;
  proposedData?: Record<string, unknown>;
  sourcePage?: number | null;
  evidenceText?: string | null;
  confidence?: string;
  eventType?: string | null;
  occurredAt?: string | null;
  scheduledAt?: string | null;
  isScheduled?: boolean;
  sourceDocumentId?: string;
  sourceFilename?: string;
};

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

@Injectable()
export class TerrainUpdateProposalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessScopeService,
    private readonly audit: AuditService,
    private readonly snapshots: StatusSnapshotService,
    private readonly notifications: NotificationsService,
  ) {}

  private assertAdmin(user: AuthUser) {
    if (!this.access.isAdmin(user)) {
      throw new ForbiddenException({
        code: "AI_PROPOSAL_REVIEW_FORBIDDEN",
        message: "Seul un administrateur peut valider les propositions d’analyse.",
      });
    }
  }

  present(row: {
    id: string;
    requisitionId: string | null;
    documentId: string | null;
    extractionType: string;
    payloadJson: unknown;
    confidence: string;
    status: string;
    reviewedAt: Date | null;
    createdAt: Date;
    document?: { title: string; category: string } | null;
  }) {
    const payload = row.payloadJson as ProposalPayload;
    const proposalType = row.extractionType.replace(/^TERRAIN_UPDATE\./, "");
    return {
      id: row.id,
      requisitionId: row.requisitionId,
      documentId: row.documentId,
      proposalType,
      title: payload.title ?? proposalType,
      summary: payload.summary ?? null,
      proposedData: payload.proposedData ?? {},
      confidence: payload.confidence ?? row.confidence,
      sourcePage: payload.sourcePage ?? null,
      evidenceText: payload.evidenceText ?? null,
      sourceFilename: payload.sourceFilename ?? row.document?.title ?? null,
      status: row.status,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async listForRequisition(requisitionId: string, user: AuthUser, status = "PROPOSED") {
    await this.access.assertCanAccessRequisition(user, requisitionId);
    if (!this.access.isAdmin(user)) {
      throw new ForbiddenException({
        code: "AI_PROPOSAL_VIEW_FORBIDDEN",
        message: "Les propositions d’analyse sont réservées à l’administration.",
      });
    }

    const rows = await this.prisma.aIExtraction.findMany({
      where: {
        requisitionId,
        extractionType: { startsWith: "TERRAIN_UPDATE." },
        status: status as never,
      },
      include: { document: { select: { title: true, category: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.present(r));
  }

  async countPendingForAdmin() {
    return this.prisma.aIExtraction.count({
      where: {
        extractionType: { startsWith: "TERRAIN_UPDATE." },
        status: "PROPOSED",
      },
    });
  }

  async getProposal(requisitionId: string, proposalId: string, user: AuthUser) {
    this.assertAdmin(user);
    await this.access.assertCanAccessRequisition(user, requisitionId);
    const row = await this.prisma.aIExtraction.findFirst({
      where: {
        id: proposalId,
        requisitionId,
        extractionType: { startsWith: "TERRAIN_UPDATE." },
      },
      include: { document: { select: { title: true, category: true } } },
    });
    if (!row) throw new NotFoundException("Proposition introuvable.");
    return this.present(row);
  }

  async reject(requisitionId: string, proposalId: string, user: AuthUser) {
    this.assertAdmin(user);
    await this.access.assertCanAccessRequisition(user, requisitionId);
    const row = await this.prisma.aIExtraction.findFirst({
      where: { id: proposalId, requisitionId, extractionType: { startsWith: "TERRAIN_UPDATE." } },
    });
    if (!row) throw new NotFoundException("Proposition introuvable.");
    if (row.status === "REJECTED") return this.present(row);
    if (row.status === "CONFIRMED") {
      throw new BadRequestException({
        code: "PROPOSAL_ALREADY_CONFIRMED",
        message: "Cette proposition a déjà été confirmée.",
      });
    }

    const updated = await this.prisma.aIExtraction.update({
      where: { id: proposalId },
      data: {
        status: "REJECTED",
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
      include: { document: { select: { title: true, category: true } } },
    });

    await this.audit.write({
      actorUserId: user.id,
      action: "ai_proposal.reject",
      entityType: "AIExtraction",
      entityId: proposalId,
      metadata: { requisitionId, extractionType: row.extractionType },
    });

    return this.present(updated);
  }

  async confirm(
    requisitionId: string,
    proposalId: string,
    user: AuthUser,
    options?: { manualValue?: string; resolution?: "KEEP_CURRENT" | "USE_PROPOSED" | "MANUAL_VALUE" },
  ) {
    this.assertAdmin(user);
    await this.access.assertCanAccessRequisition(user, requisitionId);

    const row = await this.prisma.aIExtraction.findFirst({
      where: { id: proposalId, requisitionId, extractionType: { startsWith: "TERRAIN_UPDATE." } },
      include: {
        document: true,
        requisition: { select: { reference: true } },
      },
    });
    if (!row) throw new NotFoundException("Proposition introuvable.");
    if (row.status === "CONFIRMED") {
      return { proposal: this.present(row), alreadyConfirmed: true };
    }
    if (row.status !== "PROPOSED") {
      throw new BadRequestException({
        code: "PROPOSAL_NOT_REVIEWABLE",
        message: "Cette proposition ne peut plus être confirmée.",
      });
    }

    const payload = row.payloadJson as ProposalPayload;
    const proposalType = row.extractionType.replace(/^TERRAIN_UPDATE\./, "");

    const result = await this.prisma.$transaction(async (tx) => {
      const confirmed = await tx.aIExtraction.update({
        where: { id: proposalId },
        data: {
          status: "CONFIRMED",
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
      });

      const domainResult = await this.applyConfirmedProposal(tx, {
        requisitionId,
        proposalType,
        payload,
        documentId: row.documentId,
        userId: user.id,
        options,
      });

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "ai_proposal.confirm",
          entityType: "AIExtraction",
          entityId: proposalId,
          newValues: {
            proposalType,
            domainResult,
            resolution: options?.resolution,
            manualValue: options?.manualValue,
          },
          metadata: { requisitionId },
        },
      });

      return { confirmed, domainResult };
    });

    await this.snapshots.refreshFromEvents(requisitionId);

    const notifyTitle = this.notificationTitleForProposal(proposalType, payload);
    if (notifyTitle) {
      await this.notifications.notifyAssignedUsersOfConfirmedUpdate(
        requisitionId,
        row.requisition?.reference ?? requisitionId,
        notifyTitle,
        payload.title ?? notifyTitle,
      );
    }

    const refreshed = await this.prisma.aIExtraction.findUnique({
      where: { id: proposalId },
      include: { document: { select: { title: true, category: true } } },
    });

    return {
      proposal: this.present(refreshed!),
      domainResult: result.domainResult,
      alreadyConfirmed: false,
    };
  }

  private notificationTitleForProposal(type: string, payload: ProposalPayload): string | null {
    if (["NEW_HEARING", "HEARING_POSTPONED", "COURT_DECISION", "BORNAGE_UPDATE"].includes(type)) {
      return "Mise à jour du dossier";
    }
    if (type === "NEW_COURT_CASE") return "Nouvelle affaire judiciaire";
    if (type === "PROCEDURAL_UPDATE") return "Mise à jour de situation";
    if (payload.title?.toLowerCase().includes("bornage")) return "Mise à jour bornage";
    return null;
  }

  private parseDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private async applyConfirmedProposal(
    tx: Prisma.TransactionClient,
    ctx: {
      requisitionId: string;
      proposalType: string;
      payload: ProposalPayload;
      documentId: string | null;
      userId: string;
      options?: { manualValue?: string; resolution?: string };
    },
  ) {
    const data = ctx.payload.proposedData ?? {};
    const now = new Date();

    if (ctx.proposalType === "IDENTITY_CONFLICT") {
      const field = textValue(data.field);
      const resolution = ctx.options?.resolution ?? "KEEP_CURRENT";
      if (resolution === "KEEP_CURRENT") {
        return { action: "identity_kept" };
      }
      const newValue =
        resolution === "MANUAL_VALUE"
          ? ctx.options?.manualValue
          : textValue(data.documentValue);
      if (!newValue) throw new BadRequestException("Valeur manuelle requise.");

      const update: Record<string, unknown> = {};
      if (field === "surface" || field === "surfaceArea") {
        const m = newValue.match(/(\d+)\s*ha\s*(\d+)\s*a\s*(\d+)\s*ca/i);
        if (m) {
          update.surfaceHectares = Number(m[1]);
          update.surfaceAres = Number(m[2]);
          update.surfaceCentiares = Number(m[3]);
        }
      } else if (field === "propertyName") update.propertyName = newValue;
      else if (field === "location") update.location = newValue;
      else if (field === "seller") update.sellerName = newValue;
      else if (field === "buyer") update.buyerName = newValue;
      else if (field === "requisitionReference") update.reference = newValue;

      if (Object.keys(update).length) {
        await tx.requisition.update({
          where: { id: ctx.requisitionId },
          data: update,
        });
      }
      return { action: "identity_updated", field, newValue };
    }

    if (ctx.proposalType === "NEW_COURT_CASE") {
      const caseNumber = textValue(data.caseNumber).trim();
      if (!caseNumber) throw new BadRequestException("Numéro d'affaire manquant.");
      const existing = await tx.legalCase.findFirst({
        where: { caseNumber, deletedAt: null },
      });
      if (existing) return { action: "court_case_exists", legalCaseId: existing.id };

      const legalCase = await tx.legalCase.create({
        data: {
          requisitionId: ctx.requisitionId,
          caseNumber,
          courtName: textValue(data.courtName, "Non renseigné"),
          caseType: textValue(data.caseType, "À confirmer"),
          currentPhase: textValue(data.currentPhase, "À confirmer"),
          opposingParties: textValue(data.opposingParties, "Non renseigné"),
          currentStage: "A_CONFIRMER",
        },
      });
      await tx.terrainEvent.create({
        data: {
          requisitionId: ctx.requisitionId,
          type: "COURT_CASE_CREATED",
          occurredAt: now,
          title: `Affaire ${caseNumber}`,
          shortDescription: ctx.payload.summary ?? null,
          source: "AI_PROPOSAL",
          sourceDocumentId: ctx.documentId,
          createdByUserId: ctx.userId,
          validatedByUserId: ctx.userId,
          validationStatus: "CONFIRMED",
          legalCaseId: legalCase.id,
        },
      });
      return { action: "court_case_created", legalCaseId: legalCase.id };
    }

    if (
      ["NEW_HEARING", "NEW_EVENT", "HEARING_POSTPONED", "COURT_DECISION", "BORNAGE_UPDATE", "PROCEDURAL_UPDATE"].includes(
        ctx.proposalType,
      )
    ) {
      const eventType = (ctx.payload.eventType ??
        data.eventType ??
        this.defaultEventType(ctx.proposalType)) as TerrainEventType;

      const occurredAt = this.parseDate(ctx.payload.occurredAt ?? textValue(data.occurredAt)) ?? now;
      const scheduledAt = this.parseDate(ctx.payload.scheduledAt ?? textValue(data.scheduledAt));
      const isFuture = scheduledAt ? scheduledAt > now : occurredAt > now;
      const isScheduled = ctx.payload.isScheduled ?? Boolean(scheduledAt && isFuture);

      if (ctx.proposalType === "HEARING_POSTPONED") {
        const previousDate = this.parseDate(textValue(data.previousDate));
        const newDate = this.parseDate(textValue(data.newDate ?? ctx.payload.scheduledAt));
        if (previousDate && newDate) {
          await tx.terrainEvent.updateMany({
            where: {
              requisitionId: ctx.requisitionId,
              validationStatus: "CONFIRMED",
              isScheduled: true,
              scheduledAt: previousDate,
            },
            data: { isScheduled: false },
          });
        }
      }

      const legalCaseId = textValue(data.legalCaseId) || null;
      let resolvedLegalCaseId: string | null = legalCaseId;
      if (!resolvedLegalCaseId && data.caseNumber) {
        const lc = await tx.legalCase.findFirst({
          where: {
            requisitionId: ctx.requisitionId,
            caseNumber: textValue(data.caseNumber),
            deletedAt: null,
          },
        });
        resolvedLegalCaseId = lc?.id ?? null;
      }

      const event = await tx.terrainEvent.create({
        data: {
          requisitionId: ctx.requisitionId,
          type: eventType,
          occurredAt,
          title: ctx.payload.title ?? eventType,
          shortDescription: ctx.payload.summary ?? ctx.payload.evidenceText ?? null,
          source: "AI_PROPOSAL",
          sourceDocumentId: ctx.documentId,
          legalCaseId: resolvedLegalCaseId,
          createdByUserId: ctx.userId,
          validatedByUserId: ctx.userId,
          validationStatus: "CONFIRMED",
          isScheduled,
          scheduledAt: isScheduled ? (scheduledAt ?? occurredAt) : null,
          payloadJson: toPrismaJsonObject(data),
        },
      });
      return { action: "event_created", terrainEventId: event.id };
    }

    if (ctx.proposalType === "NEW_OPPOSITION") {
      const opposition = await tx.opposition.create({
        data: {
          requisitionId: ctx.requisitionId,
          oppositionNumber:
            data.oppositionNumber != null ? Number(data.oppositionNumber) : undefined,
          opponentName: textValue(data.opponentName, "Non identifié"),
          type: textValue(data.type, "A_QUALIFIER") as never,
          scope: textValue(data.scope, "Non renseigné"),
          description: ctx.payload.summary ?? "Opposition détectée dans un document.",
          ancfccStatus: textValue(data.ancfccStatus, "À confirmer"),
          courtStatus: textValue(data.courtStatus, "À confirmer"),
          riskLevel: "A_CONFIRMER",
          strategy: "ANALYSER",
          sourceDocumentId: ctx.documentId,
          referenceDate: this.parseDate(textValue(data.referenceDate)) ?? undefined,
        },
      });
      await tx.terrainEvent.create({
        data: {
          requisitionId: ctx.requisitionId,
          type: "OPPOSITION_ADDED",
          occurredAt: now,
          title: `Opposition — ${opposition.opponentName}`,
          shortDescription: ctx.payload.summary ?? null,
          source: "AI_PROPOSAL",
          sourceDocumentId: ctx.documentId,
          createdByUserId: ctx.userId,
          validatedByUserId: ctx.userId,
          validationStatus: "CONFIRMED",
        },
      });
      return { action: "opposition_created", oppositionId: opposition.id };
    }

    if (ctx.proposalType === "DOCUMENT_INFORMATION") {
      return { action: "information_acknowledged" };
    }

    return { action: "noop", proposalType: ctx.proposalType };
  }

  private defaultEventType(proposalType: string): TerrainEventType {
    switch (proposalType) {
      case "NEW_HEARING":
        return "COURT_HEARING_SCHEDULED";
      case "HEARING_POSTPONED":
        return "COURT_HEARING_POSTPONED";
      case "COURT_DECISION":
        return "COURT_DECISION";
      case "BORNAGE_UPDATE":
        return "BORNAGE_SCHEDULED";
      default:
        return "GENERAL_UPDATE";
    }
  }
}
