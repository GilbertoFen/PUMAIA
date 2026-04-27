import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
@Injectable()
export class AICategoryService {
  constructor(private prisma: PrismaService) {}

  async create(name: string) {
    return await this.prisma.aICategory.create({ data: { name } });
  }

  async findAll() {
    return await this.prisma.aICategory.findMany();
  }
}