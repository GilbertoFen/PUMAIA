import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAreaExpertiseDto } from './dto/create-area-expertise.dto';
@Injectable()
export class AreasExpertiseService {
    constructor(private prisma: PrismaService) { }

    async create(dto: CreateAreaExpertiseDto) {
        return await this.prisma.areaExpertise.create({
            data: { name: dto.name }
        });
    }

    async findAll() {
        return await this.prisma.areaExpertise.findMany();
    }

    async remove(id: string) {
        return await this.prisma.areaExpertise.delete({
            where: { id },
        });
    }
}
