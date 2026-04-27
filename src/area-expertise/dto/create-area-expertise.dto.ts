import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class CreateAreaExpertiseDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name!: string; // El '!' para que TS no se queje
}