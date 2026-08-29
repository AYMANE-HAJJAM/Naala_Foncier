import { Global, Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "./jwt.strategy.js";

@Global()
@Module({ imports: [PassportModule], providers: [JwtStrategy] })
export class AuthenticationModule {}
