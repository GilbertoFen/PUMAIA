import { IsUUID, IsNotEmpty, IsString } from 'class-validator';

export class MarkAttendanceDto {
  @IsUUID()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  secret: string;
}

