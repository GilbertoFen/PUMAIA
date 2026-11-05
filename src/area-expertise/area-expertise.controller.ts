import { Controller, Param, Body, Get, Post, Delete, UseGuards } from '@nestjs/common';
import { AreasExpertiseService } from './area-expertise.service';
import { CreateAreaExpertiseDto } from './dto/create-area-expertise.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { RoleType } from '@prisma/client';

@Controller('areas-expertise')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AreasExpertiseController {
    constructor(private readonly service: AreasExpertiseService) { }

    @Post()
    @Roles(RoleType.INSTITUTION_ADMIN)
    async create(@Body() dto: CreateAreaExpertiseDto) {
        const area = await this.service.create(dto);
        return {
            message: 'Área de expertise creada con éxito',
            data: {
                id: area.id,
                area_name: area.name.toUpperCase()
            }
        };
    }

    @Get()
    async findAll() {
        const areas = await this.service.findAll();
        return areas.map(area => ({
            id: area.id,
            name: area.name,
            label: area.name
        }));
    }

    @Delete(':id')
    @Roles(RoleType.INSTITUTION_ADMIN)
    remove(@Param('id') id: string) {
        return this.service.remove(id);
    }
}