/**
 * Factual public summaries for the six principal terrains.
 * Baseline: Presentation1.pptx, Presentation2.pptx, strategic DOCX + IMPORT_REVIEW.
 * Do not treat strategic “actions recommandées” as live workflow or completed events.
 */
export type TerrainSummarySeed = {
  reference: string;
  isPrincipal: boolean;
  /** Short status-aligned explanation for the situation panel */
  currentSituation: string;
  /** Unknown / missing information only — not solutions */
  pointsToClarify: string[];
  /** Kept in DB for internal/admin planning; never shown as USER status progress */
  resolutionSteps: string[];
  latestKnownEvent: string | null;
  latestKnownEventAt: string | null; // YYYY-MM-DD
  eventResult: string | null;
  latestJudicialEvent: string | null;
  latestJudicialEventAt: string | null;
  judicialResult: string | null;
  nextScheduledEventAt: string | null;
  courtReached: "Oui" | "Non" | "À confirmer";
  dataFreshness: string;
  cardConstraint: string;
  /** Portfolio hint only — not USER overview roadmap */
  cardNextAction: string;
  eventLabel: string | null;
  nextAction: string;
  sourceMeta: {
    sourceFilename: string;
    slideOrSection: string;
    confidence: "high" | "medium" | "low";
  };
};

export const PRINCIPAL_REFERENCES = [
  "R 20657/31",
  "R 20629/31",
  "R 20696/31",
  "R 20611/31",
  "R 20612/31",
  "R 148026/31",
] as const;

export const terrainSummaries: TerrainSummarySeed[] = [
  {
    reference: "R 148026/31",
    isPrincipal: true,
    currentSituation:
      "Le premier bornage a été empêché sur le terrain malgré la présence des autorités.",
    pointsToClarify: [
      "Identité des personnes ayant bloqué le bornage",
      "Existence du procès-verbal d’incident",
      "État ANCFCC après le blocage",
      "Nouvelle date de bornage",
    ],
    resolutionSteps: [
      "Obtenir le procès-verbal de l’incident de bornage",
      "Identifier les opposants et leurs motifs",
      "Demander un statut ANCFCC actualisé",
      "Organiser une nouvelle opération de bornage",
    ],
    latestKnownEvent: "Tentative de bornage bloquée",
    latestKnownEventAt: "2025-06-25",
    eventResult: null,
    latestJudicialEvent: null,
    latestJudicialEventAt: null,
    judicialResult: "Aucun événement judiciaire confirmé",
    nextScheduledEventAt: null,
    courtReached: "Non",
    dataFreshness: "Situation à actualiser",
    cardConstraint: "Bornage bloqué — opposants non identifiés",
    cardNextAction: "Situation à actualiser après le blocage du 25/06/2025",
    eventLabel: "Tentative de bornage bloquée le 25/06/2025",
    nextAction: "Situation actuelle à actualiser.",
    sourceMeta: {
      sourceFilename: "Présentation1.pptx",
      slideOrSection: "slide 32",
      confidence: "high",
    },
  },
  {
    reference: "R 20612/31",
    isPrincipal: true,
    currentSituation:
      "Contentieux réciproque et possible chevauchement avec R 16605/31.",
    pointsToClarify: [
      "Compte rendu de l’audience du 15/07/2026",
      "Situation actuelle des dossiers 249 et 250",
      "Plan de superposition avec R 16605/31",
      "Résultat ou suite procédurale",
    ],
    resolutionSteps: [
      "Obtenir le compte rendu du 15/07/2026",
      "Récupérer les deux dossiers tribunal",
      "Obtenir les plans superposés",
    ],
    latestKnownEvent: "Audience annoncée",
    latestKnownEventAt: "2026-07-15",
    eventResult: "Compte rendu ou situation actuelle à renseigner",
    latestJudicialEvent: "Audience annoncée",
    latestJudicialEventAt: "2026-07-15",
    judicialResult: "Compte rendu ou situation actuelle à renseigner",
    nextScheduledEventAt: null,
    courtReached: "Oui",
    dataFreshness: "Résultat à renseigner",
    cardConstraint: "Possible chevauchement avec R 16605/31",
    cardNextAction: "Compte rendu de l’audience du 15/07/2026 à renseigner",
    eventLabel: "Audience annoncée le 15/07/2026 — compte rendu à renseigner",
    nextAction: "Compte rendu ou situation actuelle à renseigner.",
    sourceMeta: {
      sourceFilename: "Présentation1.pptx",
      slideOrSection: "slide 25",
      confidence: "high",
    },
  },
  {
    reference: "R 20696/31",
    isPrincipal: true,
    currentSituation:
      "Dossier judiciaire critique avec 27 oppositions.",
    pointsToClarify: [
      "Résultat de la moudawala du 08/07/2026",
      "Situation actuelle du dossier tribunal",
      "Localisation des oppositions partielles",
    ],
    resolutionSteps: [
      "Renseigner le résultat de la moudawala",
      "Récupérer le dossier tribunal",
      "Localiser les surfaces contestées",
    ],
    latestKnownEvent: "Moudawala annoncée",
    latestKnownEventAt: "2026-07-08",
    eventResult: "Résultat de la moudawala à renseigner",
    latestJudicialEvent: "Moudawala annoncée",
    latestJudicialEventAt: "2026-07-08",
    judicialResult: "Résultat de la moudawala à renseigner",
    nextScheduledEventAt: null,
    courtReached: "Oui",
    dataFreshness: "Résultat à renseigner",
    cardConstraint: "27 oppositions — résultat moudawala manquant",
    cardNextAction: "Résultat de la moudawala du 08/07/2026 à renseigner",
    eventLabel: "Moudawala du 08/07/2026 — résultat à renseigner",
    nextAction: "Résultat de la moudawala à renseigner.",
    sourceMeta: {
      sourceFilename: "Présentation1.pptx",
      slideOrSection: "slide 11",
      confidence: "high",
    },
  },
  {
    reference: "R 20657/31",
    isPrincipal: true,
    currentSituation: "Oppositions multiples à clarifier.",
    pointsToClarify: [
      "Confirmation de la transmission au tribunal",
      "Numéro de dossier tribunal éventuel",
      "Matrice des oppositions (totales / partielles / indivis)",
      "Procès-verbaux de bornage / délimitation",
    ],
    resolutionSteps: [
      "Confirmer la situation judiciaire",
      "Récupérer les copies intégrales des oppositions",
      "Obtenir les PV de bornage",
    ],
    latestKnownEvent:
      "Transmission vers le tribunal mentionnée par la conservation",
    latestKnownEventAt: null,
    eventResult: null,
    latestJudicialEvent:
      "Le dossier était indiqué comme en cours de transmission au tribunal par la conservation.",
    latestJudicialEventAt: null,
    judicialResult: "Transmission mentionnée — statut non stabilisé",
    nextScheduledEventAt: null,
    courtReached: "À confirmer",
    dataFreshness: "Situation à actualiser",
    cardConstraint: "Oppositions multiples — tribunal à confirmer",
    cardNextAction: "Situation judiciaire à actualiser",
    eventLabel: "Transmission au tribunal mentionnée — à confirmer",
    nextAction: "Situation judiciaire à actualiser.",
    sourceMeta: {
      sourceFilename: "Présentation1.pptx",
      slideOrSection: "slide 2",
      confidence: "medium",
    },
  },
  {
    reference: "R 20611/31",
    isPrincipal: true,
    currentSituation:
      "Dossier au tribunal avec environ dix oppositions.",
    pointsToClarify: [
      "Nature exacte de l’événement du 22/07/2026",
      "Résultat ou suite procédurale",
      "Statut des oppositions transformées",
    ],
    resolutionSteps: [
      "Clarifier la nature de l’événement du 22/07/2026",
      "Récupérer le dossier tribunal",
      "Clarifier le statut des oppositions transformées",
    ],
    latestKnownEvent: "Événement judiciaire mentionné le 22/07/2026",
    latestKnownEventAt: "2026-07-22",
    eventResult: "Nature et résultat à clarifier",
    latestJudicialEvent: "Événement judiciaire mentionné le 22/07/2026",
    latestJudicialEventAt: "2026-07-22",
    judicialResult: "Nature et résultat à clarifier",
    nextScheduledEventAt: null,
    courtReached: "Oui",
    dataFreshness: "Date ou nature à clarifier",
    cardConstraint: "Événement du 22/07/2026 — nature à clarifier",
    cardNextAction: "Nature et résultat de l’événement du 22/07/2026 à clarifier",
    eventLabel: "Événement judiciaire mentionné le 22/07/2026 — à clarifier",
    nextAction: "Nature et résultat à clarifier.",
    sourceMeta: {
      sourceFilename: "Présentation1.pptx",
      slideOrSection: "slide 20",
      confidence: "medium",
    },
  },
  {
    reference: "R 20629/31",
    isPrincipal: true,
    currentSituation:
      "Dossier au tribunal avec oppositions totales et une opposition partielle importante.",
    pointsToClarify: [
      "Prochaine date judiciaire",
      "Situation actuelle du dossier 2025/1403/237",
      "Localisation de l’opposition partielle (~15 ha)",
      "Documents d’opposition complets",
    ],
    resolutionSteps: [
      "Actualiser la situation judiciaire",
      "Localiser l’opposition partielle",
      "Récupérer le dossier tribunal",
    ],
    latestKnownEvent: "Dossier enregistré au tribunal de Sidi Ifni",
    latestKnownEventAt: null,
    eventResult: null,
    latestJudicialEvent: "Dossier enregistré au tribunal de Sidi Ifni",
    latestJudicialEventAt: null,
    judicialResult: "Enregistré — prochaine date et situation à actualiser",
    nextScheduledEventAt: null,
    courtReached: "Oui",
    dataFreshness: "Situation à actualiser",
    cardConstraint: "Opposition partielle ~15 ha — dates à actualiser",
    cardNextAction: "Prochaine date et situation judiciaire à actualiser",
    eventLabel: "Dossier au tribunal 2025/1403/237 — situation à actualiser",
    nextAction: "Prochaine date et situation judiciaire à actualiser.",
    sourceMeta: {
      sourceFilename: "Présentation1.pptx",
      slideOrSection: "slide 6",
      confidence: "high",
    },
  },
  {
    reference: "R 16605/31",
    isPrincipal: false,
    currentSituation:
      "Réquisition liée à R 20612/31 (conflit réciproque / chevauchement potentiel). Identité et surface à confirmer.",
    pointsToClarify: [
      "Identité et surface exactes",
      "Analyse conjointe avec R 20612/31",
    ],
    resolutionSteps: [
      "Obtenir le plan certifié",
      "Comparer avec R 20612/31",
    ],
    latestKnownEvent: null,
    latestKnownEventAt: null,
    eventResult: null,
    latestJudicialEvent: null,
    latestJudicialEventAt: null,
    judicialResult: "À analyser avec R 20612/31",
    nextScheduledEventAt: null,
    courtReached: "À confirmer",
    dataFreshness: "Situation à actualiser",
    cardConstraint: "Dossier lié — données à confirmer",
    cardNextAction: "Données d’identité à confirmer",
    eventLabel: null,
    nextAction: "Données à confirmer.",
    sourceMeta: {
      sourceFilename: "Présentation1.pptx",
      slideOrSection: "slide 25",
      confidence: "low",
    },
  },
];
