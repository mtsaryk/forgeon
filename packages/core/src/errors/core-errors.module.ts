import { Module } from '@nestjs/common';
import { CoreExceptionFilter } from './core-exception.filter';

@Module({
  providers: [CoreExceptionFilter],
  exports: [CoreExceptionFilter],
})
export class CoreErrorsModule {}
