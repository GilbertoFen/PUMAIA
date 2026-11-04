import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfessionalExperienceDto } from './dto/create-professional-experience.dto';

@Injectable()
export class ProfessionalExperienceService {
  private readonly logger = new Logger(ProfessionalExperienceService.name);

  constructor(private prisma: PrismaService) {}

  async assign(dto: CreateProfessionalExperienceDto) {
    if (!dto.studentId) {
      throw new BadRequestException('El studentId es obligatorio.');
    }

    const area = await this.prisma.areaExpertise.findUnique({
      where: { id: dto.areaExpertiseId },
    });
    if (!area) {
      throw new NotFoundException('Área de expertise no encontrada.');
    }

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException('Categoría no encontrada.');
    }

    return await this.prisma.professionalExperience.create({
      data: {
        studentId: dto.studentId,
        areaExpertiseId: dto.areaExpertiseId,
        categoryId: dto.categoryId,
      },
      include: {
        areaExpertise: true,
        category: true,
        student: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async findByStudent(studentId: string) {
    return await this.prisma.professionalExperience.findMany({
      where: { studentId },
      include: {
        areaExpertise: true,
        category: true,
      },
    });
  }

  async update(id: string, dto: { areaExpertiseId?: string; categoryId?: string }, studentId?: string) {
    const existing = await this.prisma.professionalExperience.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Experiencia profesional no encontrada.');
    }

    if (studentId && existing.studentId !== studentId) {
      throw new ForbiddenException('No tienes autorización para modificar esta experiencia profesional.');
    }

    return await this.prisma.professionalExperience.update({
      where: { id },
      data: {
        ...(dto.areaExpertiseId && { areaExpertiseId: dto.areaExpertiseId }),
        ...(dto.categoryId && { categoryId: dto.categoryId }),
      },
      include: {
        areaExpertise: true,
        category: true,
      },
    });
  }

  async remove(id: string, studentId?: string) {
    const existing = await this.prisma.professionalExperience.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Experiencia profesional no encontrada.');
    }

    if (studentId && existing.studentId !== studentId) {
      throw new ForbiddenException('No tienes autorización para eliminar esta experiencia profesional.');
    }

    return await this.prisma.professionalExperience.delete({
      where: { id },
    });
  }

  async parseAndSaveExperience(studentId: string, rawExperienceText: string) {
    if (!rawExperienceText || rawExperienceText.trim().length === 0) {
      throw new BadRequestException('El texto de la experiencia no puede estar vacío.');
    }

    const fastApiUrl =
      process.env.FASTAPI_EXPERIENCE_URL ||
      process.env.FASTAPI_URL ||
      'https://server-genai.onrender.com/analyze-experience';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(fastApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experience_text: rawExperienceText.trim() }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) {
        throw new Error(`Servidor de IA devolvió código HTTP ${response.status}`);
      }

      const aiData = await response.json();
      const areaName = aiData.areaExpertise || 'Desarrollo de Software';
      const categoryEnum = aiData.categoryEnum || 'SISTEMAS_COMPUTACIONALES';

      // Buscar o crear el área de expertise
      let area = await this.prisma.areaExpertise.findFirst({
        where: { name: { equals: areaName, mode: 'insensitive' } },
      });

      if (!area) {
        area = await this.prisma.areaExpertise.create({
          data: { name: areaName },
        });
      }

      // Buscar la categoría por su enum
      let category = await this.prisma.category.findFirst({
        where: { category: categoryEnum },
      });

      if (!category) {
        const anyCat = await this.prisma.category.findFirst();
        if (!anyCat) throw new NotFoundException('No existen categorías configuradas.');
        category = anyCat;
      }

      // Asignar experiencia al alumno
      return await this.assign({
        studentId,
        areaExpertiseId: area.id,
        categoryId: category.id,
      });
    } catch (error: any) {
      this.logger.error(`Error en análisis de experiencia con IA: ${error?.message || error}`);
      throw new InternalServerErrorException(
        'No se pudo clasificar la experiencia profesional con IA en este momento.',
      );
    }
  }
}
