import { Controller, Body, Get, Post } from '@nestjs/common';
import { AICategoryService } from './ai-category.service';

@Controller('ai-category')
export class AICategoryController {
  constructor(private readonly service: AICategoryService) {}

  @Post()
  create(@Body() data: { name: string }) {
    return this.service.create(data.name);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }
}