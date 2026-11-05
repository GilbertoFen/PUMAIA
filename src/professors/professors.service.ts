import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfessorDto } from './dto/create-professor.dto';
import { UpdateProfessorDto } from './dto/update-professor.dto';
import { CreateStudyDto } from './dto/create-study.dto';
import { CreatePublicationDto } from './dto/create-publication.dto';

@Injectable()
export class ProfessorsService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Crea un nuevo registro de profesor.
   */
  async create(dto: CreateProfessorDto) {
    if (dto.userId) {
      const existingUser = await this.prisma.user.findUnique({
        where: { id: dto.userId },
      });
      if (!existingUser) {
        throw new NotFoundException('Usuario institucional no encontrado.');
      }

      const existingProf = await this.prisma.professor.findUnique({
        where: { userId: dto.userId },
      });
      if (existingProf) {
        throw new ConflictException('Este usuario ya está vinculado a otro perfil de profesor.');
      }
    }

    if (dto.academicCategoryId) {
      const cat = await this.prisma.academicCategory.findUnique({
        where: { id: dto.academicCategoryId },
      });
      if (!cat) {
        throw new NotFoundException('Categoría académica no encontrada.');
      }
    }

    return this.prisma.professor.create({
      data: {
        name: dto.name.trim(),
        lastNameP: dto.lastNameP.trim(),
        lastNameM: dto.lastNameM?.trim() || null,
        startYear: dto.startYear || null,
        academicCategoryId: dto.academicCategoryId || null,
        active: dto.active ?? true,
        userId: dto.userId || null,
      },
      include: {
        user: true,
        academicCategory: true,
      },
    });
  }

  /**
   * Lista profesores con filtros opcionales.
   */
  async findAll(active?: boolean, search?: string) {
    return this.prisma.professor.findMany({
      where: {
        ...(active !== undefined && { active }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { lastNameP: { contains: search, mode: 'insensitive' } },
            { lastNameM: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        academicCategory: true,
        studies: true,
        publications: true,
        courses: {
          include: { subject: true },
        },
        _count: {
          select: { sections: true },
        },
      },
      orderBy: [{ lastNameP: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Obtiene un profesor por ID.
   */
  async findOne(id: string) {
    const prof = await this.prisma.professor.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            lastNameP: true,
            lastNameM: true,
            avatarUrl: true,
            status: true,
          },
        },
        academicCategory: true,
        studies: { orderBy: { year: 'desc' } },
        publications: { orderBy: { year: 'desc' } },
        courses: { include: { subject: true } },
        sections: {
          include: {
            subject: true,
            period: true,
          },
        },
      },
    });

    if (!prof) {
      throw new NotFoundException(`Profesor con ID ${id} no encontrado.`);
    }

    return prof;
  }

  /**
   * Actualiza el perfil de un profesor.
   */
  async update(id: string, dto: UpdateProfessorDto) {
    await this.findOne(id);

    if (dto.academicCategoryId) {
      const cat = await this.prisma.academicCategory.findUnique({
        where: { id: dto.academicCategoryId },
      });
      if (!cat) {
        throw new NotFoundException('Categoría académica no encontrada.');
      }
    }

    return this.prisma.professor.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.lastNameP && { lastNameP: dto.lastNameP.trim() }),
        ...(dto.lastNameM !== undefined && { lastNameM: dto.lastNameM?.trim() || null }),
        ...(dto.startYear !== undefined && { startYear: dto.startYear }),
        ...(dto.academicCategoryId !== undefined && { academicCategoryId: dto.academicCategoryId }),
        ...(dto.active !== undefined && { active: dto.active }),
        ...(dto.userId !== undefined && { userId: dto.userId }),
      },
    });
  }

  /**
   * Agrega un grado académico o estudio al profesor.
   */
  async addStudy(professorId: string, dto: CreateStudyDto) {
    await this.findOne(professorId);

    return this.prisma.professorStudy.create({
      data: {
        professorId,
        degree: dto.degree.trim(),
        field: dto.field.trim(),
        institution: dto.institution?.trim() || null,
        year: dto.year || null,
      },
    });
  }

  /**
   * Agrega una publicación al profesor.
   */
  async addPublication(professorId: string, dto: CreatePublicationDto) {
    await this.findOne(professorId);

    return this.prisma.professorPublication.create({
      data: {
        professorId,
        title: dto.title.trim(),
        year: dto.year || null,
        url: dto.url?.trim() || null,
      },
    });
  }

  /**
   * Asigna una materia que imparte el profesor.
   */
  async assignSubject(professorId: string, subjectId: string) {
    await this.findOne(professorId);

    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });
    if (!subject) {
      throw new NotFoundException('Materia no encontrada.');
    }

    const existing = await this.prisma.professorCourse.findFirst({
      where: { professorId, subjectId },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.professorCourse.create({
      data: { professorId, subjectId },
      include: { subject: true },
    });
  }

  /**
   * Elimina un profesor si no tiene grupos académicos asignados.
   */
  async remove(id: string) {
    const prof = await this.findOne(id);

    if (prof.sections.length > 0) {
      throw new BadRequestException(
        'No es posible eliminar a un profesor que tiene grupos académicos asignados.',
      );
    }

    return this.prisma.professor.delete({
      where: { id },
    });
  }
}
