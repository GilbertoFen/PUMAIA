import { isBoolean, IsString } from 'class-validator';

export class CreateCareerDto{
  @IsString()
  name: string

  @IsString()
  studyPlanID: string

  @IsString()
  knowledgeAreaID: string

  @isBoolean()
  isMasters: boolean

}
