import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateUserDto {
  @ApiProperty() @IsString() firstName!: string;
  @ApiProperty() @IsString() lastName!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MinLength(8) password!: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsUUID("4", { each: true }) roleIds!: string[];
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
}

export class CreateRoleDto {
  @ApiProperty() @IsString() key!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsUUID("4", { each: true }) permissionIds!: string[];
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}
