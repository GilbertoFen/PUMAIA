import { PartialType } from '@nestjs/mapped-types';
import { CreateAdressDto } from './create-adress.dto';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateAdressDto extends PartialType(CreateAdressDto) {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    calle?: string;

    @IsOptional()
    @IsNotEmpty()
    @IsNumber()
    cp?: number;


    @IsOptional()
    @IsString()
    @IsNotEmpty()
    coloniaId?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    municipioId?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    estadoId?: string;
}
