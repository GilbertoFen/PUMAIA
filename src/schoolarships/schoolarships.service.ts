import { Injectable } from '@nestjs/common';
import { CreateSchoolarshipDto } from './dto/create-schoolarship.dto';
import { UpdateSchoolarshipDto } from './dto/update-schoolarship.dto';
import { CreateSchoolarshipUsersDto } from './dto/create-schoolarship-users.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateSchoolarshipUserDto } from './dto/update-schoolarship-users.dto';

@Injectable()
export class SchoolarshipsService {
  constructor(private prisma: PrismaService) { }

  async create(createSchoolarshipDto: CreateSchoolarshipDto) {
    try {
      const category = await this.prisma.category.findUnique({
        where: { id: createSchoolarshipDto.categoryId }
      });
      if (!category) {
        throw new Error('Categoria no encontrada');
      }
    } catch (error) {
      throw new Error('Error al crear la beca: ');
    }
    return this.prisma.schoolarship.create({
      data: createSchoolarshipDto
    });
  }


  async createSchoolarshipUser(schoolarshipUserDto: CreateSchoolarshipUsersDto) {
    try {
      const schoolarship = await this.prisma.schoolarship.findUnique({
        where: { id: schoolarshipUserDto.schoolarshipId }
      });
      if (!schoolarship) {
        throw new Error('Beca no encontrada');
      }

      const user = await this.prisma.student.findUnique({
        where: { id: schoolarshipUserDto.studentId }
      });
      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      return this.prisma.studentSchoolarship.create({
        data: {
          schoolarshipId: schoolarshipUserDto.schoolarshipId,
          studentId: schoolarshipUserDto.studentId
        }
      });
    } catch (error) {
      throw new Error('Error al asociar la beca al usuario');
    }

  }

  findAll() {
    return this.prisma.schoolarship.findMany();
  }

  findOne(id: string) {
    return this.prisma.schoolarship.findUnique({
      where: { id }
    });
  }

  findSchoolarshipsByCategory(categoryId: string) {
    return this.prisma.schoolarship.findMany({
      where: { categoryId }
    });
  }

  findSchoolarshipUsers(schoolarshipId: string) {
    return this.prisma.studentSchoolarship.findMany({
      where: { schoolarshipId },
      include: { student: true }
    });
  }

  update(id: string, updateSchoolarshipDto: UpdateSchoolarshipDto) {
    return this.prisma.schoolarship.update({
      where: { id },
      data: updateSchoolarshipDto
    });
  }

  updateSchoolarshipUser(schoolarshipUserId: string, updateSchoolarshipUserDto: UpdateSchoolarshipUserDto) {
    return this.prisma.studentSchoolarship.update({
      where: { id: schoolarshipUserId },
      data: {
        schoolarshipId: updateSchoolarshipUserDto.schoolarshipId,
        studentId: updateSchoolarshipUserDto.studentId
      }
    });
  }

  remove(id: string) {
    return this.prisma.schoolarship.delete({
      where: { id }
    });
  }
  removeSchoolarshipUser(schoolarshipUserId: string) {
    return this.prisma.studentSchoolarship.delete({
      where: { id: schoolarshipUserId }
    });
  }
}
