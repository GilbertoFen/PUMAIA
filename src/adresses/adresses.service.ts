import { Injectable } from '@nestjs/common';
import { CreateAdressDto } from './dto/create-adress.dto';
import { UpdateAdressDto } from './dto/update-adress.dto';
import { Adress } from './entities/adress.entity';
import { v4 as uuidv4 } from 'uuid';


@Injectable()
export class AdressesService {
  private adresses: Adress[] = [];
  create(createAdressDto: CreateAdressDto) {
    const newAdress = {
      id: uuidv4(),
      street: createAdressDto.street,
      city: createAdressDto.city,
      state: createAdressDto.state,
      zipCode: createAdressDto.zipCode,
    };
    this.adresses.push(newAdress);
    return newAdress;
  }

  findAll() {
    return this.adresses;
  }

  findOne(id: number) {
    return `This action returns a #${id} adress`;
  }

  update(id: number, updateAdressDto: UpdateAdressDto) {
    return `This action updates a #${id} adress`;
  }

  remove(id: number) {
    return `This action removes a #${id} adress`;
  }
}
