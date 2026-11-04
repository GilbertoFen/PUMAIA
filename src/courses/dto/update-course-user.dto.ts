import { IsOptional, IsString } from 'class-validator';

export class UpdateCourseUserDto {
  @IsOptional()
  @IsString()
  courseId?: string;
}