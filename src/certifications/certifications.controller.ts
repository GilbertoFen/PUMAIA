import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CertificationsService } from './certifications.service';
import { CreateCertificationDto } from './dto/create-certification.dto';
import { UpdateCertificationDto } from './dto/update-certification.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { RoleType } from '@prisma/client';

@Controller('certifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CertificationsController {
  constructor(private readonly certificationsService: CertificationsService) {}

  @Post()
  @Roles(RoleType.INSTITUTION_ADMIN)
  create(@Body() createCertificationDto: CreateCertificationDto) {
    return this.certificationsService.create(createCertificationDto);
  }

  @Get()
  findAll() {
    return this.certificationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.certificationsService.findOne(id);
  }

  @Get('language/:languageId')
  findCertificationByLanguageId(@Param('languageId') languageId: string) {
    return this.certificationsService.findCertificationByLanguageId(languageId);
  }

  @Patch(':id')
  @Roles(RoleType.INSTITUTION_ADMIN)
  update(@Param('id') id: string, @Body() updateCertificationDto: UpdateCertificationDto) {
    return this.certificationsService.update(id, updateCertificationDto);
  }

  @Delete(':id')
  @Roles(RoleType.INSTITUTION_ADMIN)
  remove(@Param('id') id: string) {
    return this.certificationsService.remove(id);
  }
}
