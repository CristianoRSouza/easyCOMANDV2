import { Module } from '@nestjs/common';
import { MenusService } from './application/menus.use-cases';
import { MenusController } from './http/menus.controller';
import { MenusRepository } from './infrastructure/menus.repository';

/** Tela "Menus" (`easyCONTROL/src/lib/menus/*`). */
@Module({
  controllers: [MenusController],
  providers: [MenusRepository, MenusService],
})
export class MenusModule {}
