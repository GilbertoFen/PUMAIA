import { IsInt, IsString, IsOptional } from "class-validator"

export class UpdateStudyPlanDto {
    @IsString()
    @IsOptional()
    studyPlan?: String
    
    @IsInt()
    @IsOptional()
    semesters?: Number
}