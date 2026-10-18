import { Module } from '@nestjs/common';
import { RbacService } from './application/rbac.use-cases';
import { RbacController } from './http/rbac.controller';
import { RbacRepository } from './infrastructure/rbac.repository';

/** RBAC (`easyCONTROL/src/lib/rbac/*` e `hooks/usePermissions.tsx`). */
@Module({
  controllers: [RbacController],
  providers: [RbacRepository, RbacService],
})
export class RbacModule {}
