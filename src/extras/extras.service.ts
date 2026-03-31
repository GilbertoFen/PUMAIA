import { Injectable } from '@nestjs/common';
import { CreateExtraDto } from './dto/create-extra.dto';
import { UpdateExtraDto } from './dto/update-extra.dto';

@Injectable()
export class ExtrasService {
  create(createExtraDto: CreateExtraDto) {
    return 'This action adds a new extra';
  }

  findAll() {
    return `This action returns all extras`;
  }

  findOne(id: number) {
    return `This action returns a #${id} extra`;
  }

  update(id: number, updateExtraDto: UpdateExtraDto) {
    return `This action updates a #${id} extra`;
  }

  remove(id: number) {
    return `This action removes a #${id} extra`;
  }
}
