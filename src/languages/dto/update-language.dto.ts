import { PartialType } from '@nestjs/mapped-types';
import { CreateLanguageDto } from './create-language.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateLanguageDto extends PartialType(CreateLanguageDto) {
  @IsOptional()
  @IsString()
  name?: string;
}
