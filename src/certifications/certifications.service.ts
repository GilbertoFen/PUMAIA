import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCertificationDto } from './dto/create-certification.dto';
import { UpdateCertificationDto } from './dto/update-certification.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class CertificationsService {
  constructor(private prisma: PrismaService) { }
  async create(dto: CreateCertificationDto) {
    try {
      const language = await this.prisma.language.findUnique({
        where: { id: dto.languageId },
      });
      if (!language) {
        throw new NotFoundException('Idioma no encontrado');
      }
      return await this.prisma.certification.create({
        data: {
          name: dto.name,
          language: {
            connect: { id: dto.languageId },
          },
        },
        include: {
          language: true,
        },
      });
    } catch (error) {
      throw new BadRequestException('Error al crear la certificación');
    }
  }

  findAll() {
    return this.prisma.certification.findMany({
      include: {
        language: true,
      }
    });
  }

  findOne(id: string) {
    return this.prisma.certification.findUnique({
      where: { id },
      include: {
        language: true,
      },
    });
  }

  findCertificationByLanguageId(languageId: string) {
    return this.prisma.certification.findMany({
      where: { languageId },
      include: {
        language: true,
      },
    });
  }
  update(id: string, updateCertificationDto: UpdateCertificationDto) {
    return this.prisma.certification.update({
      where: { id },
      data: {
        name: updateCertificationDto.name,
        languageId: updateCertificationDto.languageId,
      },
      include: {
        language: true,
      },
    });
  }

  remove(id: string) {
    return this.prisma.certification.delete({
      where: { id },
    });
  }
}
