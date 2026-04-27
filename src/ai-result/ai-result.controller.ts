import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { AIResultService } from './ai-result.service';
import { CreateAIResultDto } from './dto/create-ai-result.dto';

@Controller('ai-result')
export class AIResultController {
  constructor(private readonly service: AIResultService) { }
  @Post()
  async save(@Body() dto: CreateAIResultDto) {
    const res = await this.service.create(dto);

    return {
      message: "Resultado de IA generado con éxito",
      student: res.student.name,
      category: res.category.name,
      test_id: res.id
    };
  }

  @Get('student/:id')
  async getResults(@Param('id') id: string) {
    const results = await this.service.findByStudent(id);

    return results.map(r => ({
      date_id: r.id,
      category: r.category.name,
      recommendations: [
        { label: r.optionA, desc: r.descriptionA },
        { label: r.optionB, desc: r.descriptionB },
        { label: r.optionC, desc: r.descriptionC },
        { label: r.optionD, desc: r.descriptionD },
        { label: r.optionE, desc: r.descriptionE },
      ]
    }));
  }
  
  @Get('student/:id')
  getByStudent(@Param('id') id: string) {
    return this.service.getByStudent(id);
  }
}