import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CareerService } from './career.service';
import { CreateCareerDto } from './dto/createCareer.dto';
import { UpdateCareerDto } from './dto/updateCareer.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { RoleType } from '@prisma/client';

@Controller('career')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CareerController {
    constructor(private readonly careerService: CareerService) {}

    // GET
    @Get('')
    async getAllCareers() {
        return this.careerService.getAllCareers();
    }

    @Get(':id')
    async getCareerById(@Param('id') id: string) {
        return this.careerService.getCareerById(id);
    }

    // POST (Administrador)
    @Post('')
    @Roles(RoleType.INSTITUTION_ADMIN)
    async createCareer(@Body() dto: CreateCareerDto) {
        return this.careerService.createCareer(dto);
    }
    
    // PUT (Administrador)
    @Put(':id')
    @Roles(RoleType.INSTITUTION_ADMIN)
    async updateCareer(@Body() dto: UpdateCareerDto, @Param('id') id: string) {
        return this.careerService.updateCareer(id, dto);
    }

    // DELETE (Administrador)
    @Delete(':id')
    @Roles(RoleType.INSTITUTION_ADMIN)
    async deleteCareer(@Param('id') id: string) {
        return this.careerService.deleteCareer(id);
    }
}
