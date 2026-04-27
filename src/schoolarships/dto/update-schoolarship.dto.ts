import { PartialType } from '@nestjs/mapped-types';
import { CreateSchoolarshipDto } from './create-schoolarship.dto';

export class UpdateSchoolarshipDto extends PartialType(CreateSchoolarshipDto) {
    name?: string | undefined;
    categoryId?: string | undefined;
}
