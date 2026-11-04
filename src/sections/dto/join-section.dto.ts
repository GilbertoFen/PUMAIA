import { IsString, IsNotEmpty } from 'class-validator';

export class JoinSectionDto {
  @IsString()
  @IsNotEmpty()
  joinCode: string;
}

