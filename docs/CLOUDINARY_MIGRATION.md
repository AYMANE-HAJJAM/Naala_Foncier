# Migration legacy storage → Cloudinary

Existing `DocumentVersion` rows created before Cloudinary may still reference:

- `storageProvider = BACKBLAZE_B2`
- `storageProvider = LOCAL`

These records are **kept** in Neon. Their binary files are **not** claimed as migrated.

## Behaviour after Cloudinary cut-over

- New uploads always use `CLOUDINARY` with `type=authenticated`.
- Preview / download of a legacy version returns HTTP **410 Gone** with code `LEGACY_STORAGE_UNAVAILABLE`.
- Operators should re-upload the file into the correct document category so a new Cloudinary version is created.

## Future migration procedure (manual)

1. Export legacy object keys from `DocumentVersion` where `storageProvider <> 'CLOUDINARY'`.
2. For each file still recoverable from B2/local archive:
   - Download privately
   - Upload to Cloudinary authenticated folder:
     `naala-foncier/requisitions/{safeRef}/{category}/{uuid}`
   - Insert a new `DocumentVersion` with Cloudinary metadata fields
   - Point `Document.currentVersionId` to the new version
3. Leave the old version row intact for audit (do not delete).

Do **not** rewrite historical `storageKey` values in place without verifying the Cloudinary asset exists.
