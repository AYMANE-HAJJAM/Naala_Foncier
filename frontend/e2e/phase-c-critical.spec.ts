import { expect, test, type APIRequestContext } from "@playwright/test";
import { qa } from "./qa-env";

const apiBase = process.env.E2E_API_BASE_URL ?? "http://localhost:3201/api";

type Session = { token: string; user: { id: string; roles: string[] } };

async function login(request: APIRequestContext, email: string, password: string): Promise<Session> {
  const response = await request.post(`${apiBase}/auth/login`, { data: { email, password } });
  expect(response.status()).toBe(200);
  const body = await response.json();
  return { token: body.accessToken, user: body.user };
}

function auth(session: Session) {
  return { Authorization: `Bearer ${session.token}` };
}

async function getWithTransportRetry(
  request: APIRequestContext,
  url: string,
  options?: Parameters<APIRequestContext["get"]>[1],
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await request.get(url, options);
    } catch (error) {
      lastError = error;
      if (!String(error).includes("ECONNRESET")) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw lastError;
}

async function json(response: Awaited<ReturnType<APIRequestContext["get"]>>) {
  const body = await response.text();
  expect(response.ok(), body).toBeTruthy();
  return body ? JSON.parse(body) : undefined;
}

test.describe.serial("Phase C - parcours critiques API", () => {
  test("authentification, permissions, workflows et idempotence", async ({ request }) => {
    test.setTimeout(180_000);
    const admin = await login(request, qa.QA_ADMIN_EMAIL, qa.QA_ADMIN_PASSWORD);
    const assigned = await login(request, qa.QA_ASSIGNED_EMAIL, qa.QA_ASSIGNED_PASSWORD);
    const unassigned = await login(request, qa.QA_UNASSIGNED_EMAIL, qa.QA_UNASSIGNED_PASSWORD);
    expect(admin.user.roles).toContain("ADMIN");
    expect(assigned.user.roles).toContain("USER");

    const adminTerrains = await json(await request.get(`${apiBase}/requisitions`, { headers: auth(admin) }));
    const terrain = adminTerrains.find((item: { number: string }) => item.number === qa.QA_REQUISITION_REFERENCE);
    expect(terrain).toBeTruthy();
    const terrainId = terrain.id as string;

    const assignedTerrains = await json(await request.get(`${apiBase}/requisitions`, { headers: auth(assigned) }));
    expect(assignedTerrains.map((item: { id: string }) => item.id)).toContain(terrainId);
    const unassignedTerrains = await json(await request.get(`${apiBase}/requisitions`, { headers: auth(unassigned) }));
    expect(unassignedTerrains.map((item: { id: string }) => item.id)).not.toContain(terrainId);

    for (const path of [
      `/requisitions/${terrainId}`,
      `/requisitions/${terrainId}/documents`,
      `/requisitions/${terrainId}/events`,
      `/requisitions/${terrainId}/legal-cases`,
      `/requisitions/${terrainId}/oppositions`,
      `/requisitions/${terrainId}/reports`,
    ]) {
      const response = await request.get(`${apiBase}${path}`, { headers: auth(unassigned) });
      expect(response.status(), path).toBe(403);
    }

    const forbiddenMutations = [
      request.post(`${apiBase}/legal-cases`, { headers: auth(assigned), data: { requisitionId: terrainId, caseNumber: "QA-FORBIDDEN", courtName: "QA", caseType: "Foncier", currentPhase: "Test", opposingParties: "Non renseigné" } }),
      request.post(`${apiBase}/oppositions`, { headers: auth(assigned), data: { requisitionId: terrainId, type: "TOTALE" } }),
      request.post(`${apiBase}/reports`, { headers: auth(assigned), data: { requisitionId: terrainId, reportType: "QA", title: "Interdit" } }),
      request.post(`${apiBase}/terrain-events`, { headers: auth(assigned), data: { requisitionId: terrainId, type: "GENERAL_UPDATE", occurredAt: new Date().toISOString(), title: "Interdit" } }),
    ];
    for (const response of await Promise.all(forbiddenMutations)) expect(response.status()).toBe(403);

    const caseIds: string[] = [];
    for (const suffix of ["A", "B"]) {
      const response = await request.post(`${apiBase}/legal-cases`, {
        headers: auth(admin),
        data: { requisitionId: terrainId, caseNumber: `QA-C-${Date.now()}-${suffix}`, courtName: "Tribunal QA", caseType: "Foncier", currentPhase: "Instruction", currentStage: "EN_ATTENTE_AUDIENCE", currentStatus: "Actif", opposingParties: "Non renseigné" },
      });
      caseIds.push((await json(response)).id);
    }
    const cases = await json(await request.get(`${apiBase}/requisitions/${terrainId}/legal-cases`, { headers: auth(admin) }));
    expect(cases.filter((item: { id: string }) => caseIds.includes(item.id))).toHaveLength(2);

    const firstDate = new Date(Date.now() + 14 * 86400_000).toISOString();
    const secondDate = new Date(Date.now() + 35 * 86400_000).toISOString();
    const event = await json(await request.post(`${apiBase}/terrain-events`, {
      headers: auth(admin),
      data: { requisitionId: terrainId, legalCaseId: caseIds[0], type: "COURT_HEARING_SCHEDULED", occurredAt: new Date().toISOString(), scheduledAt: firstDate, isScheduled: true, title: "Audience QA initiale" },
    }));
    const postponed = await json(await request.post(`${apiBase}/terrain-events/${event.id}/reschedule`, {
      headers: auth(admin), data: { scheduledAt: secondDate, title: "Audience QA reportée" },
    }));
    const timeline = await json(await request.get(`${apiBase}/requisitions/${terrainId}/events`, { headers: auth(admin) }));
    const original = timeline.find((item: { id: string }) => item.id === event.id);
    expect(original.isScheduled).toBe(false);
    expect(timeline.find((item: { id: string }) => item.id === postponed.id).isScheduled).toBe(true);
    const assignedCalendar = await json(await request.get(`${apiBase}/calendar/upcoming?days=90`, { headers: auth(assigned) }));
    expect(assignedCalendar.some((item: { id: string }) => item.id === postponed.id)).toBe(true);
    expect(assignedCalendar.some((item: { id: string }) => item.id === event.id)).toBe(false);

    const oppositionBase = Math.floor(Date.now() / 1000) % 1_000_000;
    const oppositionNumbers = [oppositionBase, oppositionBase + 1];
    for (const [oppositionNumber, type] of [[oppositionNumbers[0], "TOTALE"], [oppositionNumbers[1], "PARTIELLE"]] as const) {
      await json(await request.post(`${apiBase}/oppositions`, {
        headers: auth(admin), data: { requisitionId: terrainId, oppositionNumber, type, claimedSurfaceHectares: oppositionNumber === 902 ? 1 : 0, notes: "Fixture QA Phase C" },
      }));
    }
    const oppositions = await json(await request.get(`${apiBase}/requisitions/${terrainId}/oppositions`, { headers: auth(assigned) }));
    expect(oppositions.filter((item: { number: number }) => oppositionNumbers.includes(item.number))).toHaveLength(2);

    const reportTitle = `Rapport Phase C ${Date.now()}`;
    const report = await json(await request.post(`${apiBase}/reports`, {
      headers: auth(admin), data: { requisitionId: terrainId, reportType: "SUIVI_QA", title: reportTitle },
    }));
    let visible = await json(await request.get(`${apiBase}/requisitions/${terrainId}/reports`, { headers: auth(assigned) }));
    expect(visible.some((item: { id: string }) => item.id === report.id)).toBe(false);
    await json(await request.post(`${apiBase}/reports/${report.id}/versions`, { headers: auth(admin), data: { contentJson: { summary: "Recette" }, generatedBy: "ADMIN QA", sourceCount: 0 } }));
    await json(await request.post(`${apiBase}/reports/${report.id}/submit-validation`, { headers: auth(admin) }));
    await json(await request.post(`${apiBase}/reports/${report.id}/validate`, { headers: auth(admin) }));
    const published = await json(await request.post(`${apiBase}/reports/${report.id}/publish`, { headers: auth(admin) }));
    expect(published.statusCode).toBe("PUBLIE");
    const publishedAgain = await json(await request.post(`${apiBase}/reports/${report.id}/publish`, { headers: auth(admin) }));
    expect(publishedAgain.id).toBe(report.id);
    visible = await json(await request.get(`${apiBase}/requisitions/${terrainId}/reports`, { headers: auth(assigned) }));
    expect(visible.filter((item: { id: string }) => item.id === report.id)).toHaveLength(1);
    const hidden = await request.get(`${apiBase}/reports/${report.id}`, { headers: auth(unassigned) });
    expect(hidden.status()).toBe(403);

    const notifications = await json(await request.get(`${apiBase}/notifications`, { headers: auth(assigned) }));
    expect(notifications.filter((item: { description: string }) => item.description === reportTitle)).toHaveLength(1);

    const grantOne = await request.post(`${apiBase}/requisitions/${terrainId}/access`, { headers: auth(admin), data: { userId: unassigned.user.id } });
    expect(grantOne.ok()).toBeTruthy();
    const grantTwo = await request.post(`${apiBase}/requisitions/${terrainId}/access`, { headers: auth(admin), data: { userId: unassigned.user.id } });
    expect(grantTwo.ok()).toBeTruthy();
    const access = await json(await request.get(`${apiBase}/requisitions/${terrainId}/access`, { headers: auth(admin) }));
    expect(access.filter((item: { userId: string }) => item.userId === unassigned.user.id)).toHaveLength(1);
    expect((await request.delete(`${apiBase}/requisitions/${terrainId}/access/${unassigned.user.id}`, { headers: auth(admin) })).status()).toBe(204);
    expect((await request.get(`${apiBase}/requisitions/${terrainId}`, { headers: auth(unassigned) })).status()).toBe(403);

    expect((await request.post(`${apiBase}/auth/refresh`)).status()).toBe(200);
    expect((await request.post(`${apiBase}/auth/logout`)).status()).toBe(204);
    expect((await request.post(`${apiBase}/auth/refresh`)).status()).toBe(401);
  });

  test("wizard réel: Cloudinary, catégories, skip AI et confirmation idempotente", async ({ request, browser }) => {
    test.setTimeout(300_000);
    const admin = await login(request, qa.QA_ADMIN_EMAIL, qa.QA_ADMIN_PASSWORD);
    const assigned = await login(request, qa.QA_ASSIGNED_EMAIL, qa.QA_ASSIGNED_PASSWORD);
    const unassigned = await login(request, qa.QA_UNASSIGNED_EMAIL, qa.QA_UNASSIGNED_PASSWORD);
    const draft = await json(await request.post(`${apiBase}/terrain-drafts`, { headers: auth(admin) }));

    const pdfPage = await browser.newPage();
    await pdfPage.setContent("<!doctype html><html><body><h1>NAALA FONCIER</h1><p>Fixture QA Phase C</p></body></html>");
    const pdf = await pdfPage.pdf({ format: "A4" });
    await pdfPage.close();
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=", "base64");
    const docx = Buffer.from("PK\u0003\u0004QA-PHASE-C-DOCX", "binary");
    const uploaded: Array<{ id: string; filename: string }> = [];

    async function upload(filename: string, mimeType: string, category: string, buffer: Buffer, customCategoryName?: string) {
      const session = await json(await request.post(`${apiBase}/terrain-drafts/${draft.id}/upload-sessions`, {
        headers: auth(admin), data: { originalFilename: filename, mimeType, sizeBytes: buffer.length, category, customCategoryName },
      }));
      const fields = Object.fromEntries(Object.entries(session.fields as Record<string, unknown>).map(([key, value]) => [key, String(value)]));
      const cloudinary = await json(await request.post(session.uploadUrl, {
        multipart: { ...fields, file: { name: filename, mimeType, buffer } },
      }));
      const updated = await json(await request.post(`${apiBase}/terrain-drafts/${draft.id}/documents`, {
        headers: auth(admin),
        data: {
          publicId: cloudinary.public_id ?? session.publicId,
          originalFilename: filename,
          mimeType,
          sizeBytes: buffer.length,
          category,
          customCategoryName,
          cloudinaryAssetId: cloudinary.asset_id,
          cloudinaryResourceType: cloudinary.resource_type,
          cloudinaryDeliveryType: cloudinary.type,
          format: cloudinary.format,
        },
      }));
      const item = updated.documents.find((document: { originalFilename: string }) => document.originalFilename === filename);
      uploaded.push({ id: item.id, filename });
      return item;
    }

    const firstPdf = await upload("qa-ancfcc-1.pdf", "application/pdf", "ANCFCC", pdf);
    await upload("qa-ancfcc-2.pdf", "application/pdf", "ANCFCC", pdf);
    await upload("qa-acte-1.pdf", "application/pdf", "ACTES", pdf);
    await upload("qa-acte-2.pdf", "application/pdf", "ACTES", pdf);
    await upload("qa-terrain.png", "image/png", "TERRAIN", png);
    await upload("qa-piece.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "ACTES", docx);
    await upload("qa-procuration.pdf", "application/pdf", "AUTRE", pdf, "Procuration");

    const renamed = await json(await request.patch(`${apiBase}/terrain-drafts/${draft.id}/custom-category`, {
      headers: auth(admin), data: { fromName: "Procuration", toName: "Mandat QA" },
    }));
    expect(renamed.documents.some((document: { customCategoryName?: string }) => document.customCategoryName === "Mandat QA")).toBe(true);
    const removed = await json(await request.delete(`${apiBase}/terrain-drafts/${draft.id}/documents/${firstPdf.id}`, { headers: auth(admin) }));
    expect(removed.documents.some((document: { id: string }) => document.id === firstPdf.id)).toBe(false);
    await upload("qa-ancfcc-1-readded.pdf", "application/pdf", "ANCFCC", pdf);

    const unavailableAi = await json(await request.post(`${apiBase}/terrain-drafts/${draft.id}/analyze`, { headers: auth(admin) }));
    expect(unavailableAi.errorCode).toBe("AI_PROVIDER_NOT_CONFIGURED");
    const ready = await json(await request.post(`${apiBase}/terrain-drafts/${draft.id}/skip-analysis`, { headers: auth(admin) }));
    expect(ready.status).toBe("READY_FOR_REVIEW");
    const reference = `TEST-QA-WIZ-${Date.now()}`;
    const future = new Date(Date.now() + 21 * 86400_000).toISOString();
    const confirmation = {
      identity: { requisitionReference: reference, propertyName: "Terrain wizard QA", location: "Sidi Ifni", surface: "2 ha 10 a 05 ca", seller: "Non renseigné", buyer: "Non renseigné" },
      initialSituationLabel: "Recette wizard",
      initialSituationSummary: "Fixture contrôlée Phase C",
      initialEvents: [{ type: "BORNAGE_SCHEDULED", occurredAt: future, scheduledAt: future, isScheduled: true, title: "Bornage QA" }],
    };
    const created = await json(await request.post(`${apiBase}/terrain-drafts/${draft.id}/confirm`, { headers: auth(admin), data: confirmation }));
    const createdAgain = await json(await request.post(`${apiBase}/terrain-drafts/${draft.id}/confirm`, { headers: auth(admin), data: confirmation }));
    expect(createdAgain.id).toBe(created.id);
    const documents = await json(await request.get(`${apiBase}/requisitions/${created.id}/documents`, { headers: auth(admin) }));
    expect(documents).toHaveLength(7);
    expect(documents.some((document: { customCategoryName?: string }) => document.customCategoryName === "Mandat QA")).toBe(true);
    const terrain = await json(await request.get(`${apiBase}/requisitions/${created.id}`, { headers: auth(admin) }));
    expect(terrain.number).toBe(reference);
    expect(terrain.nextScheduledEventAt).toBe(future.slice(0, 10));

    await json(await request.post(`${apiBase}/requisitions/${created.id}/access`, { headers: auth(admin), data: { userId: assigned.user.id } }));
    expect((await request.post(`${apiBase}/requisitions/${created.id}/documents/${documents[0].id}/analyze`, { headers: auth(assigned) })).status()).toBe(403);
    const unavailableUpdateAi = await json(await request.post(`${apiBase}/requisitions/${created.id}/documents/${documents[0].id}/analyze`, { headers: auth(admin) }));
    expect(unavailableUpdateAi.errorCode).toBe("AI_PROVIDER_NOT_CONFIGURED");
    const analysisStatus = await json(await request.get(`${apiBase}/requisitions/${created.id}/documents/${documents[0].id}/analysis-status`, { headers: auth(assigned) }));
    expect(analysisStatus.status).toBe("FAILED");
    expect(analysisStatus.userMessage).toBe("Analyse automatique indisponible");
    const preview = await json(await getWithTransportRetry(request, `${apiBase}/documents/${documents[0].id}/preview-url`, { headers: auth(assigned) }));
    const download = await json(await getWithTransportRetry(request, `${apiBase}/documents/${documents[0].id}/download-url`, { headers: auth(assigned) }));
    expect(preview.url).toMatch(/^https:\/\//);
    expect(download.url).toMatch(/^https:\/\//);
    expect((await request.get(preview.url)).status()).toBe(200);
    expect((await request.get(`${apiBase}/documents/${documents[0].id}/preview-url`, { headers: auth(unassigned) })).status()).toBe(403);
  });
});
