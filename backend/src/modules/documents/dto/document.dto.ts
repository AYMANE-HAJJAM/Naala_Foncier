import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import {
  DocumentCategory,
  DocumentConfidentiality,
  DocumentStatus,
  DocumentVisibility,
  SourceQuality,
} from "../../../generated/prisma/enums.js";

export class CreateUploadSessionDto {
  @ApiProperty() @IsUUID() requisitionId!: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() documentId?: string;
  @ApiProperty() @IsString() title!: string;
  @ApiProperty({ enum: DocumentCategory })
  @IsEnum(DocumentCategory)
  category!: DocumentCategory;
  @ApiPropertyOptional({
    description: "Required when category is AUTRE. Terrain-specific label.",
  })
  @IsOptional()
  @IsString()
  customCategoryName?: string;
  @ApiProperty() @IsString() originalFilename!: string;
  @ApiProperty() @IsString() mimeType!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) sizeBytes!: number;
  @ApiPropertyOptional({ enum: DocumentVisibility })
  @IsEnum(DocumentVisibility)
  @IsOptional()
  visibility?: DocumentVisibility;
  @ApiPropertyOptional() @IsString() @IsOptional() documentDate?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
}
export class CreateLegacyDocumentRequestDto {
  @ApiProperty() @IsString() title!: string;
  @ApiProperty() @IsString() category!: string;
}
export class CompleteUploadSessionDto {
  @ApiPropertyOptional({ enum: SourceQuality })
  @IsEnum(SourceQuality)
  @IsOptional()
  sourceQuality?: SourceQuality;
  @ApiPropertyOptional() @IsString() @IsOptional() sha256Checksum?: string;
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pageCount?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}
export class UpdateDocumentDto {
  @ApiPropertyOptional() @IsString() @IsOptional() title?: string;
  @ApiPropertyOptional({ enum: DocumentCategory })
  @IsEnum(DocumentCategory)
  @IsOptional()
  category?: DocumentCategory;
  @ApiPropertyOptional({ enum: DocumentStatus })
  @IsEnum(DocumentStatus)
  @IsOptional()
  status?: DocumentStatus;
  @ApiPropertyOptional({ enum: DocumentConfidentiality })
  @IsEnum(DocumentConfidentiality)
  @IsOptional()
  confidentiality?: DocumentConfidentiality;
  @ApiPropertyOptional({ enum: DocumentVisibility })
  @IsEnum(DocumentVisibility)
  @IsOptional()
  visibility?: DocumentVisibility;
  @ApiPropertyOptional() @IsString() @IsOptional() documentDate?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
}
export class RequestClearerCopyDto {
  @ApiPropertyOptional() @IsString() @IsOptional() requestedFrom?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() assignedToId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}
