import { IsEnum, IsNotEmpty, IsString } from "class-validator";


export class CreateSkillDto {
    @IsNotEmpty()
    @IsEnum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
    proficiency: string; // A1, A2, B1, B2, C1, C2
}