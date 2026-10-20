import { Injectable } from '@nestjs/common';
import { CreateLanguageDto } from './dto/create-language.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { CreateLanguageUserDto } from './dto/create-language-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UpdateLanguageUserDto } from './dto/update-language-user.dto';

@Injectable()
export class LanguagesService {
  constructor(private prisma: PrismaService) { }


  /*
  POST
  */

  async createLanguageUser(dto: CreateLanguageUserDto) {
    // 1. Buscar skill por nivel CEFR
    const skill = await this.prisma.skill.findUnique({
      where: { id: dto.skillId },
    });

    if (!skill) {
      throw new NotFoundException('Nivel CEFR no encontrado');
    }

    // 2. Validar que no exista duplicado
    const existing = await this.prisma.studentLanguage.findUnique({
      where: {
        studentId_languageId: {
          studentId: dto.studentId,
          languageId: dto.languageId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('El usuario ya tiene este idioma registrado');
    }

    // 3. Crear relación
    return this.prisma.studentLanguage.create({
      data: {
        student: {
          connect: { id: dto.studentId },
        },
        language: {
          connect: { id: dto.languageId },
        },
        skill: {
          connect: { id: skill.id },
        },
      },
      include: {
        language: true,
        skill: true,
      },
    });
  }


  async createLanguage(createLanguageDto: CreateLanguageDto) {
    try {
      return this.prisma.language.create({
        data: {
          name: createLanguageDto.name,
        },
      });
    }
    catch (error) {
      throw new BadRequestException('Error al crear el idioma');

    }
  }

  /*
  GET
  */


  findLanguageUsers() {
    return this.prisma.studentLanguage.findMany({
      include: {
        language: true,
        skill: true,
      },
    });
  }


  findLanguageUsersByUserId(studentId: string) {
    return this.prisma.studentLanguage.findMany({
      where: { studentId },
      include: {
        language: true,
        skill: true,
      },
    });
  }

  findAllLanguages() {
    return this.prisma.language.findMany();
  }

  findOneLanguage(id: string) {
    return this.prisma.language.findUnique({
      where: { id },
    });
  }

  findLanguageByName(name: string) {
    return this.prisma.language.findUnique({
      where: { name },
    });
  }


  /*
  UPDATE
  */

  updateLanguageUser(id: string, dto: UpdateLanguageUserDto) {
    return this.prisma.studentLanguage.update({
      where: { id },
      data: {
        studentId: dto.studentId,
        languageId: dto.languageId,
        skillId: dto.skillId,
      },
      include: {
        language: true,
        skill: true,
      },
    });
  }
  updateLanguage(id: string, updateLanguageDto: UpdateLanguageDto) {
    return this.prisma.language.update({
      where: { id },
      data: {
        name: updateLanguageDto.name,
        certifications: updateLanguageDto.certificationId
          ? {
            connect: { id: updateLanguageDto.certificationId },
          }
          : undefined,
      },
    });
  }

  /*
  DELETE
  */

  removeLanguage(id: string) {
    return this.prisma.language.delete({
      where: { id },
    });
  }
  removeLanguageUser(id: string) {
    return this.prisma.studentLanguage.delete({
      where: { id },
    });
  }
}
