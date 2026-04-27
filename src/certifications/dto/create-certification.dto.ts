import { IsNotEmpty, IsString } from "class-validator";

export class CreateCertificationDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    languageId: string;
}