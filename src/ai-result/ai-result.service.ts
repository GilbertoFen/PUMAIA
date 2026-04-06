import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAIResultDto } from './dto/create-ai-result.dto';
@Injectable()
export class AIResultService {
  constructor(private prisma: PrismaService) { }
  async create(dto: CreateAIResultDto) {
    return await this.prisma.aIResult.create({
      data: dto,
      include: {
        category: true,
        student: true,
      },
    });
  }

  async findByStudent(studentId: string) {
    return await this.prisma.aIResult.findMany({
      where: { studentId },
      include: { category: true },
      orderBy: { id: 'desc' }, 
    });
  }
  async saveResult(data: any) {
    return await this.prisma.aIResult.create({
      data: data,
      include: { category: true }
    });
  }

  async getByStudent(studentId: string) {
    return await this.prisma.aIResult.findMany({
      where: { studentId },
      include: { category: true }
    });
  }

  async remove(id: string) {
    return await this.prisma.aIResult.delete({ where: { id } });
  }
}