import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCareerDto } from './dto/createCareer.dto';
import { UpdateCareerDto } from './dto/updateCareer.dto';

@Injectable()
export class CareerService {
  constructor(private prisma: PrismaService) {}

  async getAllCareers() {
    return this.prisma.career.findMany({
      include: {
        knowledgeArea: true,
        studyPlan: true,
        institution: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getCareerById(id: string) {
    const career = await this.prisma.career.findUnique({
      where: { id },
      include: {
        knowledgeArea: true,
        studyPlan: true,
        institution: true,
      },
    });

    if (!career) {
      throw new NotFoundException(`Carrera con ID ${id} no encontrada.`);
    }

    return career;
  }

  async createCareer(dto: CreateCareerDto) {
    // Validar que la carrera no exista ya con la misma clave en la institución
    const institutionId = await this.resolveInstitutionId(dto.institutionId);

    const existing = await this.prisma.career.findUnique({
      where: {
        institutionId_code: {
          institutionId,
          code: dto.code,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(`Ya existe una carrera con la clave ${dto.code} en la institución.`);
    }

    return this.prisma.career.create({
      data: {
        name: dto.name,
        code: dto.code,
        isMasters: dto.isMasters,
        institution: { connect: { id: institutionId } },
        studyPlan: { connect: { id: (dto.studyPlanId || dto.studyPlanID)! } },
        knowledgeArea: { connect: { id: (dto.knowledgeAreaId || dto.knowledgeAreaID)! } },
      },
      include: {
        knowledgeArea: true,
        studyPlan: true,
      },
    });
  }

  async updateCareer(id: string, dto: UpdateCareerDto) {
    await this.getCareerById(id);

    return this.prisma.career.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        isMasters: dto.isMasters,
        ...(dto.studyPlanID ? { studyPlan: { connect: { id: dto.studyPlanID } } } : {}),
        ...(dto.knowledgeAreaID ? { knowledgeArea: { connect: { id: dto.knowledgeAreaID } } } : {}),
        ...(dto.institutionId ? { institution: { connect: { id: dto.institutionId } } } : {}),
      },
      include: {
        knowledgeArea: true,
        studyPlan: true,
      },
    });
  }

  async deleteCareer(id: string) {
    await this.getCareerById(id);

    return this.prisma.career.delete({
      where: { id },
    });
  }

  private async resolveInstitutionId(providedId?: string): Promise<string> {
    if (providedId) {
      const inst = await this.prisma.institution.findUnique({ where: { id: providedId } });
      if (inst) return inst.id;
    }

    const defaultInst = await this.prisma.institution.findFirst({
      where: { code: '240' },
    });

    if (defaultInst) return defaultInst.id;

    const anyInst = await this.prisma.institution.findFirst();
    if (anyInst) return anyInst.id;

    throw new BadRequestException('No existe ninguna institución registrada en el sistema.');
  }
}
