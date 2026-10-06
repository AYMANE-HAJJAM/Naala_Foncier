import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    super({ adapter: new PrismaPg({ connectionString: config.getOrThrow<string>("DATABASE_URL") }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    const expectedSchema = this.config.get<string>("EXPECTED_DATABASE_SCHEMA");
    const expectedDatabase = this.config.get<string>("EXPECTED_DATABASE_NAME");
    if (expectedSchema || expectedDatabase) {
      const [row] = await this.$queryRaw<Array<{ current_schema: string; current_database: string }>>`SELECT current_schema(), current_database()`;
      if (
        (expectedSchema && row?.current_schema !== expectedSchema) ||
        (expectedDatabase && row?.current_database !== expectedDatabase)
      ) {
        await this.$disconnect();
        throw new Error(
          `Database guard failed: expected ${expectedDatabase ?? "*"}/${expectedSchema ?? "*"}, received ${row?.current_database ?? "unknown"}/${row?.current_schema ?? "unknown"}.`,
        );
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
