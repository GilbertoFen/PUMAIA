import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateCareerDto{
  @IsString()
  @IsOptional()
  name?: string
  
  @IsString()
  @IsOptional()
  studyPlanID?: string
  
  @IsString()
  @IsOptional()
  knowledgeAreaID?: string
  
  @IsBoolean()
  @IsOptional()
  isMasters?: boolean

}
