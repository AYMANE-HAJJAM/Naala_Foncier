import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";
import {
  TerrainEventSource,
  TerrainEventType,
  TerrainEventValidationStatus,
} from "../../../generated/prisma/enums.js";

export class CreateTerrainEventDto {
  @ApiProperty() @IsUUID() requisitionId!: string;
  @ApiProperty({ enum: TerrainEventType }) @IsEnum(TerrainEventType) type!: TerrainEventType;
  @ApiProperty() @IsISO8601() occurredAt!: string;
  @ApiProperty() @IsString() title!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() shortDescription?: string;
  @ApiPropertyOptional({ enum: TerrainEventSource }) @IsEnum(TerrainEventSource) @IsOptional() source?: TerrainEventSource;
  @ApiPropertyOptional() @IsUUID() @IsOptional() sourceDocumentId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() hearingId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() legalCaseId?: string;
  @ApiPropertyOptional({ enum: TerrainEventValidationStatus })
  @IsEnum(TerrainEventValidationStatus)
  @IsOptional()
  validationStatus?: TerrainEventValidationStatus;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() @Type(() => Boolean) isScheduled?: boolean;
  @ApiPropertyOptional() @IsISO8601() @IsOptional() scheduledAt?: string;
  @ApiPropertyOptional() @IsObject() @IsOptional() payloadJson?: Record<string, unknown>;
}

export class UpdateTerrainEventDto extends PartialType(CreateTerrainEventDto) {}

export class RescheduleTerrainEventDto {
  @ApiProperty() @IsISO8601() scheduledAt!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() title?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() shortDescription?: string;
}
