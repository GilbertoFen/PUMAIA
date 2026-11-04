import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { StudyLevel, StudySystem } from '@prisma/client';

export class UpdateStudyPlanDto {
    @IsString()
    @IsOptional()
    studyPlan?: string;

    @IsInt()
    @IsOptional()
    semesters?: number;

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
