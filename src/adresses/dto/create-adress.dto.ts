import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreateAdressDto {
    @IsString()
    @IsNotEmpty()
    calle: string;

    @IsNotEmpty()
    @IsNumber()
    cp: number;

    @IsString()
    @IsNotEmpty()
    coloniaId: string;

    @IsString()
    @IsNotEmpty()
    municipioId: string;

    @IsString()
    @IsNotEmpty()
    estadoId: string;
}
