import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/alumno.entity';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma.service';


const hassedPassword = bcrypt.hashSync('123456', 10);



@Injectable()
export class AlumnosService {

  constructor(private prisma: PrismaService) { }
  
  async create(data: CreateUserDto) {
    return this.prisma.user.create({data});
  }
  async findAll() {
    return this.prisma.user.findMany();
  }

  update(id: string, updateUserDto: UpdateUserDto) {
    return `This 
    action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: {
        email
      }
    });
  }

}
