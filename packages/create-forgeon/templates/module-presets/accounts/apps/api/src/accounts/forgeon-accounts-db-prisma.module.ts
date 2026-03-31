import { Module } from '@nestjs/common';
import { ACCOUNTS_PERSISTENCE_PORT } from '@forgeon/accounts-api';
import { DbPrismaModule } from '@forgeon/db-prisma';
import { PrismaAccountsPersistenceStore } from './prisma-accounts-persistence.store';

@Module({
  imports: [DbPrismaModule],
  providers: [
    PrismaAccountsPersistenceStore,
    {
      provide: ACCOUNTS_PERSISTENCE_PORT,
      useExisting: PrismaAccountsPersistenceStore,
    },
  ],
  exports: [ACCOUNTS_PERSISTENCE_PORT],
})
export class ForgeonAccountsDbPrismaModule {}
