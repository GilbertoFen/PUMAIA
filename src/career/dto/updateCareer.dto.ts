import { PartialType } from '@nestjs/mapped-types';
import { CreateCareerDto } from './createCareer.dto';

export class UpdateCareerDto extends PartialType(CreateCareerDto) {}
