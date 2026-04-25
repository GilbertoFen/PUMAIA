import { isBoolean, IsOptional, IsString } from 'class-validator';

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
  
  @isBoolean()
  @IsOptional()
  isMasters?: boolean

}
