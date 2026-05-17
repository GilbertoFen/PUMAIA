import { Module } from '@nestjs/common';
import { AICategoryService } from './ai-category.service';
import { AICategoryController } from './ai-category.controller';

@Module({
  providers: [AICategoryService],
  controllers: [AICategoryController],
  exports: [AICategoryService], 
})
export class AICategoryModule {}
