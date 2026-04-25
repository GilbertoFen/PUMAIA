import { IsInt, IsString } from "class-validator"

export class CreateStudyPlanDto {
    @IsString()
    studyPlan: string
    
    @IsInt()
    semesters: number
}