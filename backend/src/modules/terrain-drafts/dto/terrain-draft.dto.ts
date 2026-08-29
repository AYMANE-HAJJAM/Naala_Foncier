import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { DocumentCategory, TerrainEventType } from "../../../generated/prisma/enums.js";

export class CreateDraftUploadSessionDto {
  @ApiProperty({ enum: DocumentCategory })
  @IsEnum(DocumentCategory)
  category!: DocumentCategory;

  @ApiPropertyOptional({
    description: "Required when category is AUTRE. Terrain-specific label, not a global enum.",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  customCategoryName?: string;

  @ApiProperty()
  @IsString()
  originalFilename!: string;

  @ApiProperty()
  @IsString()
  mimeType!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class CompleteDraftUploadDto {
  @ApiProperty() @IsString() publicId!: string;
  @ApiProperty() @IsString() originalFilename!: string;
  @ApiProperty() @IsString() mimeType!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) sizeBytes!: number;
  @ApiProperty({ enum: DocumentCategory }) @IsEnum(DocumentCategory) category!: DocumentCategory;
  @ApiPropertyOptional({
    description: "Required when category is AUTRE. Terrain-specific label, not a global enum.",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  customCategoryName?: string;
  @ApiPropertyOptional() @IsISO8601() @IsOptional() documentDate?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() cloudinaryAssetId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() cloudinaryResourceType?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() cloudinaryDeliveryType?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() format?: string;
}

export class RenameDraftCustomCategoryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  fromName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  toName!: string;
}

export class UpdateTerrainDraftReviewDto {
  @ApiPropertyOptional() @IsObject() @IsOptional() identity?: Record<string, unknown>;
  @ApiPropertyOptional() @IsObject() @IsOptional() procedural?: Record<string, unknown>;
}

class TerrainIdentityConfirmDto {
  @ApiProperty() @IsString() requisitionReference!: string;
  @ApiProperty() @IsString() propertyName!: string;
  @ApiProperty() @IsString() location!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() surface?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() seller?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() buyer?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() linkedRequisition?: string;
}

class CourtConfirmDto {
  @ApiPropertyOptional() @IsString() @IsOptional() caseNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() courtName?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() confirmed?: boolean;
}

class ConfirmedEventDto {
  @ApiProperty() @IsString() type!: string;
  @ApiProperty() @IsISO8601() occurredAt!: string;
  @ApiProperty() @IsString() title!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() shortDescription?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isScheduled?: boolean;
  @ApiPropertyOptional() @IsISO8601() @IsOptional() scheduledAt?: string;
}

class InitialEventConfirmDto {
  @ApiProperty({ enum: TerrainEventType }) @IsEnum(TerrainEventType) type!: TerrainEventType;
  @ApiProperty() @IsISO8601() occurredAt!: string;
  @ApiProperty() @IsString() title!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() shortDescription?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isScheduled?: boolean;
  @ApiPropertyOptional() @IsISO8601() @IsOptional() scheduledAt?: string;
}

export class ConfirmTerrainDraftDto {
  @ApiProperty({ type: TerrainIdentityConfirmDto })
  @ValidateNested()
  @Type(() => TerrainIdentityConfirmDto)
  identity!: TerrainIdentityConfirmDto;

  @ApiPropertyOptional() @IsString() @IsOptional() initialSituationLabel?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() initialSituationSummary?: string;
  @ApiPropertyOptional({ type: [String] }) @IsArray() @IsString({ each: true }) @IsOptional() pointsToClarify?: string[];
  @ApiPropertyOptional() @IsBoolean() @IsOptional() courtMentioned?: boolean;
  @ApiPropertyOptional({ type: CourtConfirmDto }) @ValidateNested() @Type(() => CourtConfirmDto) @IsOptional() court?: CourtConfirmDto;
  @ApiPropertyOptional({ type: [CourtConfirmDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourtConfirmDto)
  @IsOptional()
  courts?: CourtConfirmDto[];
  @ApiPropertyOptional() @Type(() => Number) @IsInt() @IsOptional() oppositionCount?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() oppositionSummary?: string;
  @ApiPropertyOptional({ type: [ConfirmedEventDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmedEventDto)
  @IsOptional()
  confirmedEvents?: ConfirmedEventDto[];
  @ApiPropertyOptional({ type: [InitialEventConfirmDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitialEventConfirmDto)
  @IsOptional()
  initialEvents?: InitialEventConfirmDto[];
  @ApiPropertyOptional() @IsObject() @IsOptional() reviewAudit?: Record<string, unknown>;
}
