import { IsBoolean, IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreateCareerDto {
    @IsString()
    @IsNotEmpty()
    name: string;
    @IsNotEmpty()
    @IsNumber()
    semesters: number;
    @IsNotEmpty()
    @IsNumber()
    studyPlan: number;
    @IsString()
    @IsNotEmpty()
    knowledgeArea: string;
    @IsBoolean()
    @IsNotEmpty()
    graduated: boolean;
}
