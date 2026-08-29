import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() pageSize = 20;
  @ApiPropertyOptional() @IsString() @IsOptional() search?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() sortBy?: string;
  @ApiPropertyOptional({ enum: ["asc", "desc"] }) @IsIn(["asc", "desc"]) @IsOptional() sortOrder: "asc" | "desc" = "asc";
}

export function paginated<T>(data: T[], page: number, pageSize: number, totalItems: number) {
  return { data, pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) } };
}
