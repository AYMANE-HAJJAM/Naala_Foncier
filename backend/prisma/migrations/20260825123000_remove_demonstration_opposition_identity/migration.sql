UPDATE "Opposition"
SET "opponentName" = NULL,
    "identityStatus" = 'A_CONFIRMER'
WHERE "opponentName" ILIKE '%identité de démonstration%'
   OR "opponentName" ILIKE '%identite de demonstration%';
