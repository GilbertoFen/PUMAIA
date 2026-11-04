import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateLanguageDto } from './dto/create-language.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { CreateLanguageUserDto } from './dto/create-language-user.dto';
import { UpdateLanguageUserDto } from './dto/update-language-user.dto';
import { PrismaService } from '../prisma/prisma.service';

const VALID_CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

@Injectable()
export class LanguagesService {
  constructor(private prisma: PrismaService) {}

  async createLanguageUser(dto: CreateLanguageUserDto) {
    if (!dto.studentId) {
      throw new BadRequestException('El studentId es obligatorio.');
    }

    let skill = await this.prisma.skill.findUnique({
      where: { id: dto.skillId },
    });

    if (!skill) {
      const upperCode = dto.skillId.trim().toUpperCase();
      if (VALID_CEFR_LEVELS.includes(upperCode)) {
        skill = await this.prisma.skill.findUnique({
          where: { proficiency: upperCode },
        });
        if (!skill && this.prisma.skill.create) {
          skill = await this.prisma.skill.create({
            data: { proficiency: upperCode },
          });
        }
      }
    }

    if (!skill) {
      throw new NotFoundException('Nivel de habilidad no encontrado.');
    }

    const language = await this.prisma.language.findUnique({
      where: { id: dto.languageId },
    });

    if (!language) {
      throw new NotFoundException('Idioma no encontrado.');
    }

    const existing = await this.prisma.studentLanguage.findUnique({
      where: {
        studentId_languageId: {
          studentId: dto.studentId,
          languageId: dto.languageId,
        },
      },
    });

    if (existing) {
      return this.prisma.studentLanguage.update({
        where: { id: existing.id },
        data: { skillId: skill.id },
        include: { language: true, skill: true },
      });
    }

    return this.prisma.studentLanguage.create({
      data: {
        studentId: dto.studentId,
        languageId: dto.languageId,
        skillId: skill.id,
      },
      include: {
        language: true,
        skill: true,
      },
    });
  }

  async createLanguage(createLanguageDto: CreateLanguageDto) {
    return this.prisma.language.create({
      data: createLanguageDto,
    });
  }

  async findAllLanguages() {
    return this.prisma.language.findMany({
      include: { certifications: true },
    });
  }

  async findOneLanguage(id: string) {
    return this.prisma.language.findUnique({
      where: { id },
      include: { certifications: true },
    });
  }

  async findLanguageUsers() {
    return this.prisma.studentLanguage.findMany({
      include: {
        student: { include: { user: true } },
        language: true,
        skill: true,
      },
    });
  }

  async findLanguageUsersByUserId(studentId: string) {
    return this.prisma.studentLanguage.findMany({
      where: { studentId },
      include: {
        language: true,
        skill: true,
      },
    });
  }

  async updateLanguage(id: string, updateLanguageDto: UpdateLanguageDto) {
    return this.prisma.language.update({
      where: { id },
      data: updateLanguageDto,
    });
  }

  async updateLanguageUser(id: string, updateLanguageUserDto: UpdateLanguageUserDto, studentId?: string) {
    const existing = await this.prisma.studentLanguage.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Idioma asignado no encontrado.');
    }

    if (studentId && existing.studentId !== studentId) {
      throw new ForbiddenException('No tienes autorización para modificar este idioma.');
    }

    return this.prisma.studentLanguage.update({
      where: { id },
      data: updateLanguageUserDto,
      include: { language: true, skill: true },
    });
  }

  async removeLanguage(id: string) {
    return this.prisma.language.delete({
      where: { id },
    });
  }

  async removeLanguageUser(id: string, studentId?: string) {
    const existing = await this.prisma.studentLanguage.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Idioma asignado no encontrado.');
    }

    if (studentId && existing.studentId !== studentId) {
      throw new ForbiddenException('No tienes autorización para eliminar este idioma.');
    }

    return this.prisma.studentLanguage.delete({
      where: { id },
    });
  }
}
