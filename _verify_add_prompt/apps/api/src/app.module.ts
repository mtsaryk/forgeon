import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { dbPrismaConfig, dbPrismaEnvSchema, DbPrismaModule } from '@forgeon/db-prisma';
import { ForgeonLoggerModule, loggerConfig, loggerEnvSchema } from '@forgeon/logger';
import { authConfig, authEnvSchema, ForgeonAuthModule } from '@forgeon/auth-api';
import { CoreConfigModule, CoreErrorsModule, coreConfig, coreEnvSchema, createEnvValidator } from '@forgeon/core';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [coreConfig, dbPrismaConfig, authConfig, loggerConfig],
      validate: createEnvValidator([coreEnvSchema, dbPrismaEnvSchema, authEnvSchema, loggerEnvSchema]),
      envFilePath: '.env',
    }),
    CoreConfigModule,
    CoreErrorsModule,
    ForgeonLoggerModule,
    DbPrismaModule,
    ForgeonAuthModule.register(),
  ],
  controllers: [HealthController],
})
export class AppModule {}
