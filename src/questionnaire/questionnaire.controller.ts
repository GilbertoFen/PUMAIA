import { Controller, Post, Get, Body, UseGuards, Req, Patch, Request } from '@nestjs/common';
import { QuestionnaireService } from './questionnaire.service';
import { SaveQuestionnaireDto } from './dto/save-questionnaire.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('questionnaire')
@UseGuards(AuthGuard('jwt'))
export class QuestionnaireController {
  constructor(private readonly questionnaireService: QuestionnaireService) { }

  @Post('save')
  async save(@Req() req, @Body() dto: SaveQuestionnaireDto) {
    return this.questionnaireService.saveAll(req.user.userId, dto);
  }

  @Get('my-answers')
  async getMyAnswers(@Req() req) {
    return this.questionnaireService.getAnswers(req.user.userId);
  }

  @Patch('/update')
  async updatePartial(
    @Request() req: any,
    @Body() dto: SaveQuestionnaireDto,
  ) {
    const studentId = req.user.userId;

    return this.questionnaireService.updateAnswers(studentId, dto);
  }
}