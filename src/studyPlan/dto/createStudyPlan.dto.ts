import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { StudyLevel, StudySystem } from '@prisma/client';

export class CreateStudyPlanDto {
    @IsString()
    studyPlan: string;

    @IsInt()
    semesters: number;

    @IsEnum(StudyLevel)
    @IsOptional()
    level?: StudyLevel;

    @IsEnum(StudySystem)
    @IsOptional()
    system?: StudySystem;

    @IsInt()
    @IsOptional()
    totalCredits?: number;

    @IsInt()
    @IsOptional()
    optionalCredits?: number;

    @IsInt()
    @IsOptional()
    firstGeneration?: number;
}
