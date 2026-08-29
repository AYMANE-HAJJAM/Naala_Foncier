import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { RequisitionStatus, RiskLevel } from "../../../generated/prisma/enums.js";

export class CreateRequisitionDto {
  @ApiProperty({ example: "R 20657/31" }) @IsString() reference!: string;
  @ApiProperty() @IsString() propertyName!: string;
  @ApiProperty() @IsString() location!: string;
  @ApiProperty() @IsString() province!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) surfaceHectares!: number;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) @Max(99) surfaceAres!: number;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) @Max(99) surfaceCentiares!: number;
  @ApiProperty() @IsString() sellerName!: string;
  @ApiProperty() @IsString() buyerName!: string;
  @ApiProperty({ enum: RiskLevel }) @IsEnum(RiskLevel) riskLevel!: RiskLevel;
  @ApiProperty({ enum: RequisitionStatus }) @IsEnum(RequisitionStatus) mainStatus!: RequisitionStatus;
  @ApiPropertyOptional() @IsString() @IsOptional() mainStatusLabel?: string;
  @ApiProperty() @IsString() mainIssue!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() summary?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() currentSituation?: string;
  @ApiPropertyOptional({ type: [String] }) @IsArray() @IsString({ each: true }) @IsOptional() constraints?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsArray() @IsString({ each: true }) @IsOptional() pointsToClarify?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsArray() @IsString({ each: true }) @IsOptional() resolutionSteps?: string[];
  @ApiPropertyOptional() @IsString() @IsOptional() latestKnownEvent?: string;
  @ApiPropertyOptional() @IsISO8601() @IsOptional() latestKnownEventAt?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() eventResult?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() latestJudicialEvent?: string;
  @ApiPropertyOptional() @IsISO8601() @IsOptional() latestJudicialEventAt?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() judicialResult?: string;
  @ApiPropertyOptional() @IsISO8601() @IsOptional() nextScheduledEventAt?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() courtReached?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() dataFreshness?: string;
  @ApiPropertyOptional() @Type(() => Number) @IsInt() @Min(0) @IsOptional() oppositionCount?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() nextAction?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() responsibleUserId?: string;
  @ApiPropertyOptional({ type: [String] }) @IsArray() @IsString({ each: true }) @IsOptional() criticalDetails?: string[];
  @ApiPropertyOptional() @Type(() => Number) @IsInt() @Min(1) @IsOptional() priorityRank?: number;
  @ApiPropertyOptional() @IsISO8601() @IsOptional() importantDate?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() eventLabel?: string;
}
export class UpdateRequisitionDto extends PartialType(CreateRequisitionDto) {}
export class RequisitionQueryDto {
  @ApiPropertyOptional() @IsString() @IsOptional() search?: string;
  @ApiPropertyOptional({ enum: RiskLevel }) @IsEnum(RiskLevel) @IsOptional() risk?: RiskLevel;
  @ApiPropertyOptional({ enum: RequisitionStatus }) @IsEnum(RequisitionStatus) @IsOptional() status?: RequisitionStatus;
  @ApiPropertyOptional() @IsString() @IsOptional() location?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() buyer?: string;
}
