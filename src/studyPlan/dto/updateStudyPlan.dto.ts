import { IsInt, IsString, IsOptional } from "class-validator"

export class UpdateStudyPlanDto {
    @IsString()
    @IsOptional()
    studyPlan?: string
    
    @IsInt()
    @IsOptional()
    semesters?: number
}