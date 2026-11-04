import { Controller, Body, Get, Post, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { AICategoryService } from './ai-category.service';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { RoleType } from '@prisma/client';

export class CreateAICategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

@Controller('ai-category')
export class AICategoryController {
  constructor(private readonly service: AICategoryService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.INSTITUTION_ADMIN)
  @Post()
  create(@Body() data: CreateAICategoryDto) {
    return this.service.create(data.name);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }
}