import { Module } from '@nestjs/common';
import { ForgeonRbacGuard } from './forgeon-rbac.guard';

@Module({
  providers: [ForgeonRbacGuard],
  exports: [ForgeonRbacGuard],
})
export class ForgeonRbacModule {}
