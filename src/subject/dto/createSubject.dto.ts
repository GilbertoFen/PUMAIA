import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la materia es obligatorio' })
  subject: string;

  @IsString()
  @IsNotEmpty({ message: 'El categoryID es obligatorio' })
  categoryID: string;

  @IsInt()
  @IsOptional()
  code?: number;

  @IsInt()
  @Min(1)
  @Max(15)
  @IsOptional()
  semester?: number;

  @IsInt()
  @IsOptional()
  credits?: number;

  @IsString()
  @IsOptional()
  studyPlanId?: string;
}
