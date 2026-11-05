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
import { CategoryEnum } from '@prisma/client';

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

    try {
      const textLower = rawExperienceText.toLowerCase();

      // Clasificación interna basada en catálogo institucional (sin dependencia externa)
      let matchedArea = 'Desarrollo de Software';
      let categoryEnum: CategoryEnum = CategoryEnum.SISTEMAS_COMPUTACIONALES;

      if (textLower.includes('dato') || textLower.includes('analytics') || textLower.includes('estadístic') || textLower.includes('bi')) {
        matchedArea = 'Ciencia de Datos y Analítica';
        categoryEnum = CategoryEnum.PROBABILIDAD_ESTADISTICA_Y_OPTIMIZACION;
      } else if (textLower.includes('ia') || textLower.includes('inteligencia') || textLower.includes('machine') || textLower.includes('aprendizaje')) {
        matchedArea = 'Inteligencia Artificial y Machine Learning';
        categoryEnum = CategoryEnum.CIENCIAS_DE_LA_COMPUTACION;
      } else if (textLower.includes('seguridad') || textLower.includes('vulnerab') || textLower.includes('ciber') || textLower.includes('audit')) {
        matchedArea = 'Ciberseguridad y Seguridad de la Información';
        categoryEnum = CategoryEnum.SISTEMAS_COMPUTACIONALES;
      } else if (textLower.includes('red') || textLower.includes('cisco') || textLower.includes('telecom') || textLower.includes('router')) {
        matchedArea = 'Redes e Infraestructura de Comunicaciones';
        categoryEnum = CategoryEnum.COMPUTACION;
      } else if (textLower.includes('cloud') || textLower.includes('aws') || textLower.includes('azure') || textLower.includes('devops') || textLower.includes('docker')) {
        matchedArea = 'Cloud Computing y DevOps';
        categoryEnum = CategoryEnum.SISTEMAS_COMPUTACIONALES;
      } else if (textLower.includes('base') || textLower.includes('sql') || textLower.includes('postgres') || textLower.includes('oracle') || textLower.includes('mongo')) {
        matchedArea = 'Bases de Datos y Modelado de Información';
        categoryEnum = CategoryEnum.COMPUTACION;
      } else if (textLower.includes('movil') || textLower.includes('móvil') || textLower.includes('android') || textLower.includes('ios') || textLower.includes('flutter')) {
        matchedArea = 'Desarrollo Móvil';
        categoryEnum = CategoryEnum.SISTEMAS_COMPUTACIONALES;
      }

      // Buscar o crear el área de expertise
      let area = await this.prisma.areaExpertise.findFirst({
        where: { name: { equals: matchedArea, mode: 'insensitive' } },
      });

      if (!area) {
        area = await this.prisma.areaExpertise.create({
          data: { name: matchedArea },
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
      this.logger.error(`Error al registrar experiencia profesional: ${error?.message || error}`);
      throw new InternalServerErrorException(
        'No se pudo registrar la experiencia profesional en este momento.',
      );
    }
  }
}
