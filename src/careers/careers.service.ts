import { Injectable } from '@nestjs/common';
import { CreateCareerDto } from './dto/create-career.dto';
import { UpdateCareerDto } from './dto/update-career.dto';
import { Career } from './entities/career.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CareersService {
  private careers: Career[] = []; // Aquí puedes definir un tipo específico para las carreras
  create(createCareerDto: CreateCareerDto) {
    const newCareer = {
      id: uuidv4(),
      name: createCareerDto.name,
      semesters: createCareerDto.semesters,
      studyPlan: createCareerDto.studyPlan, 
      knowledgeArea: createCareerDto.knowledgeArea,
      graduated: createCareerDto.graduated, // Puedes establecer un valor predeterminado para graduado
    };
    this.careers.push(newCareer);
    return newCareer;
  }

  findAll() {
    this.careers;
  }

  findOne(id: number) {
    return `This action returns a #${id} career`;
  }

  update(id: number, updateCareerDto: UpdateCareerDto) {
    return `This action updates a #${id} career`;
  }

  remove(id: number) {
    return `This action removes a #${id} career`;
  }
}
