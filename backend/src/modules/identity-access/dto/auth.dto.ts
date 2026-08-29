import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "admin@naala-foncier.ma" }) @IsEmail() email!: string;
  @ApiProperty({ example: "change-me-in-development" }) @IsString() @MinLength(8) password!: string;
}

export class AuthUserResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ type: [String] }) roles!: string[];
  @ApiProperty({ type: [String] }) permissions!: string[];
}

export class LoginResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() expiresIn!: number;
  @ApiProperty({ type: AuthUserResponseDto }) user!: AuthUserResponseDto;
}
