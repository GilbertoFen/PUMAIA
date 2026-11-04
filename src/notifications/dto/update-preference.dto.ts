import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferenceDto {
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  classReminders?: boolean;
}

