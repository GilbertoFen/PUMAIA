import { IsNotEmpty, IsString } from 'class-validator';

export class CreateContestDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  categoryId!: string;
}