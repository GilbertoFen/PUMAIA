import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCareerDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la carrera es obligatorio' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'La clave de carrera UNAM es obligatoria (ej. 121)' })
  code: string;

  @IsString()
  @IsOptional()
  institutionId?: string;

  @IsString()
  @IsOptional()
  studyPlanID?: string;

  @IsString()
  @IsOptional()
  studyPlanId?: string;

  @IsString()
  @IsOptional()
  knowledgeAreaID?: string;

  @IsString()
  @IsOptional()
  knowledgeAreaId?: string;

  @IsBoolean()
  isMasters: boolean;
}
