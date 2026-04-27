import { PartialType } from '@nestjs/mapped-types';
import { CreateSchoolarshipUsersDto } from './create-schoolarship-users.dto';

export class UpdateSchoolarshipUserDto extends PartialType(CreateSchoolarshipUsersDto) {

    schoolarshipId: string;

    userId: string;
}
