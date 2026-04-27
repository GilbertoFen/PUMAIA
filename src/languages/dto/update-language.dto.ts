import { PartialType } from '@nestjs/mapped-types';
import { CreateLanguageDto } from './create-language.dto';
import { IsString } from 'class-validator';

export class UpdateLanguageDto extends PartialType(CreateLanguageDto) {
    @IsString()
    name?: string;

    @IsString()
    certificationId?: string;
}
