import { IsOptional, IsString } from "class-validator";

export class UpdateCertificationDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    languageId?: string;
}