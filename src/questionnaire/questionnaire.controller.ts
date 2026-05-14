import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { QuestionnaireService } from './questionnaire.service';
import { SaveQuestionnaireDto } from './dto/save-questionnaire.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('questionnaire')
@UseGuards(AuthGuard('jwt'))
export class QuestionnaireController {
  constructor(private readonly questionnaireService: QuestionnaireService) {}

  @Post('save')
  async save(@Req() req, @Body() dto: SaveQuestionnaireDto) {
    return this.questionnaireService.saveAll(req.user.userId, dto);
  }

  @Get('my-answers')
  async getMyAnswers(@Req() req) {
    return this.questionnaireService.getAnswers(req.user.userId);
  }
}