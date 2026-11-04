import { IsInt, Min, Max, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateMeetingDto {
  @IsInt()
  @Min(1)
  @Max(7)
  weekday: number; // 1: Lunes, ..., 7: Domingo

  @IsString()
  @IsNotEmpty()
  startTime: string; // Formato "HH:mm" o "HH:mm:ss"

  @IsString()
  @IsNotEmpty()
  endTime: string; // Formato "HH:mm" o "HH:mm:ss"

  @IsOptional()
  @IsString()
  room?: string;
}

