import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CloudinaryStorageService } from "./cloudinary-storage.service.js";
import { StorageService } from "./storage.service.js";

@Global()
@Module({
  providers: [
    {
      provide: StorageService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new CloudinaryStorageService(config),
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
