import { Controller, Param, Body, Get, Post, Delete } from '@nestjs/common';
import { AreasExpertiseService } from './area-expertise.service';
import { CreateAreaExpertiseDto } from './dto/create-area-expertise.dto';

@Controller('areas-expertise')
export class AreasExpertiseController {
    constructor(private readonly service: AreasExpertiseService) { }

    @Post()
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
            label: area.name
        }));
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.service.remove(id);
    }
}