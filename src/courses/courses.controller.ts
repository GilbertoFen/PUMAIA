import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateCourseUserDto } from './dto/create-course-user.dto';
import { UpdateCourseUserDto } from "./dto/update-course-user.dto";

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) { }

  @Post()
  create(@Body() createCourseDto: CreateCourseDto) {
    return this.coursesService.create(createCourseDto);
  }

  @Post('courseUser')
  createCourseUser(@Body() createCourseUserDto: CreateCourseUserDto) {
    return this.coursesService.createCourseUser(createCourseUserDto);
  }

  @Get()
  findAll() {
    return this.coursesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }

  @Get('courseUsers/:userId')
  findCourseUsersByUserId(@Param('userId') userId: string) {
    return this.coursesService.findCourseUsersByUserId(userId);
  }

  @Get('category/:categoryId')
  findCoursesByCategory(@Param('categoryId') categoryId: string) {
    return this.coursesService.findCoursesByCategory(categoryId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseDto) {
    return this.coursesService.update(id, updateCourseDto);
  }

  @Patch('courseUser/:id')
  updateCourseUser(@Param('id') id: string, @Body() updateCourseUserDto: UpdateCourseUserDto) {
    return this.coursesService.updateCourseUser(id, updateCourseUserDto);
  }

  @Delete('courseUser/:id')
  removeCourseUser(@Param('id') id: string) {
    return this.coursesService.removeCourseUser(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.coursesService.remove(id);
  }
}
