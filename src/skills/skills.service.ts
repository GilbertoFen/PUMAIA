import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class SkillsService {
  constructor(private prisma: PrismaService) {}


  async create(createSkillDto: CreateSkillDto) {
    try {
      const existing = await this.findSkillByProficiency(createSkillDto.proficiency);
      if (existing) {
        throw new BadRequestException('El nivel CEFR ya existe');
      }
      const validCEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      if (!validCEFR.includes(createSkillDto.proficiency)) {
        throw new BadRequestException('Nivel CEFR inválido. Usa A1, A2, B1, B2, C1 o C2');
      }
      console.log("creando habilidad con nivel: ", createSkillDto.proficiency);
      return this.prisma.skill.create({
        data: {
          proficiency: createSkillDto.proficiency,
        },
      });
    } catch (error) {
      throw new BadRequestException('Error al crear la habilidad');
    }
  }



  //GET

  findAll() {
    return this.prisma.skill.findMany();
  }

  findOne(id: string) {
    return this.prisma.skill.findUnique({
      where: { id },
    });
  }

  findSkillByProficiency(proficiency: string) {
    return this.prisma.skill.findUnique({
      where: { proficiency },
    });
  }

  //UPDATE

  update(id: string, updateSkillDto: UpdateSkillDto) {
    return this.prisma.skill.update({
      where: { id },
      data: {
        proficiency: updateSkillDto.proficiency,
      },
    });
  }


  //DELETE

  remove(id: string) { 
    return this.prisma.skill.delete({
      where: { id },
    });
  }
}
