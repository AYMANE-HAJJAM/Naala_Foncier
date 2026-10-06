export const domainQueryKeys = {
  requisitionAccess: (requisitionId: string) => ["requisition-access", requisitionId] as const,
  terrainUpdateProposals: (requisitionId: string) => ["terrain-update-proposals", requisitionId] as const,
};
