import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Patch,
  Delete,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { QuestionnaireService } from './questionnaire.service';
import { SaveQuestionnaireDto } from './dto/save-questionnaire.dto';
import { CreateQuestionnaireDto } from './dto/create-questionnaire.dto';
import { UpdateQuestionnaireDto } from './dto/update-questionnaire.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { CreateQuestionOptionDto } from './dto/create-question-option.dto';
import { UpdateQuestionOptionDto } from './dto/update-question-option.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { CurrentUser } from '../autenticacion/decorators/current-user.decorator';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';
import { RoleType, QuestionnaireKind } from '@prisma/client';

@Controller('questionnaire')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuestionnaireController {
  constructor(private readonly questionnaireService: QuestionnaireService) {}

  // =========================================================================
  // ENDPOINTS PARA EL ALUMNO (Contratos existentes)
  // =========================================================================

  @Post('save')
  async save(@CurrentUser() user: AuthUser, @Body() dto: SaveQuestionnaireDto) {
    if (!user || !user.studentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }
    return this.questionnaireService.saveAll(user.studentId, dto, { allowOnboardingUpdate: true });
  }

  @Get('my-answers')
  async getMyAnswers(@CurrentUser() user: AuthUser) {
    if (!user || !user.studentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }
    return this.questionnaireService.getAnswers(user.studentId);
  }

  @Patch('update')
  async updatePartial(
    @CurrentUser() user: AuthUser,
    @Body() dto: SaveQuestionnaireDto,
  ) {
    if (!user || !user.studentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }
    return this.questionnaireService.updateAnswers(user.studentId, dto);
  }

  @Get('my-responses')
  async getMyResponses(@CurrentUser() user: AuthUser) {
    if (!user || !user.studentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }
    return this.questionnaireService.getStudentResponses(user.studentId);
  }

  // =========================================================================
  // CONSULTA DE ESTRUCTURA Y CUESTIONARIO ACTIVO
  // =========================================================================

  @Get('active')
  async getActiveQuestionnaire(@Query('kind') kind?: QuestionnaireKind) {
    return this.questionnaireService.getOrCreateActiveQuestionnaire(kind || QuestionnaireKind.ONBOARDING);
  }

  @Get('catalog')
  @Roles(RoleType.INSTITUTION_ADMIN, RoleType.ANALYST)
  async findAll(@Query('kind') kind?: QuestionnaireKind) {
    return this.questionnaireService.findAllQuestionnaires(kind);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.questionnaireService.findOneQuestionnaire(id);
  }

  // =========================================================================
  // GESTIÓN ADMINISTRATIVA DE CUESTIONARIOS (INSTITUTION_ADMIN)
  // =========================================================================

  @Post()
  @Roles(RoleType.INSTITUTION_ADMIN)
  async createQuestionnaire(@Body() dto: CreateQuestionnaireDto) {
    return this.questionnaireService.createQuestionnaire(dto);
  }

  @Patch(':id')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async updateQuestionnaire(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionnaireDto,
  ) {
    return this.questionnaireService.updateQuestionnaire(id, dto);
  }

  @Delete(':id')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async deleteQuestionnaire(@Param('id') id: string) {
    return this.questionnaireService.deleteQuestionnaire(id);
  }

  // =========================================================================
  // GESTIÓN ADMINISTRATIVA DE PREGUNTAS (INSTITUTION_ADMIN)
  // =========================================================================

  @Post(':id/questions')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async createQuestion(
    @Param('id') questionnaireId: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.questionnaireService.createQuestion(questionnaireId, dto);
  }

  @Patch('questions/:questionId')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async updateQuestion(
    @Param('questionId') questionId: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questionnaireService.updateQuestion(questionId, dto);
  }

  @Delete('questions/:questionId')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async deleteQuestion(@Param('questionId') questionId: string) {
    return this.questionnaireService.deleteQuestion(questionId);
  }

  // =========================================================================
  // GESTIÓN ADMINISTRATIVA DE OPCIONES (INSTITUTION_ADMIN)
  // =========================================================================

  @Post('questions/:questionId/options')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async createOption(
    @Param('questionId') questionId: string,
    @Body() dto: CreateQuestionOptionDto,
  ) {
    return this.questionnaireService.createOption(questionId, dto);
  }

  @Patch('options/:optionId')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async updateOption(
    @Param('optionId') optionId: string,
    @Body() dto: UpdateQuestionOptionDto,
  ) {
    return this.questionnaireService.updateOption(optionId, dto);
  }

  @Delete('options/:optionId')
  @Roles(RoleType.INSTITUTION_ADMIN)
  async deleteOption(@Param('optionId') optionId: string) {
    return this.questionnaireService.deleteOption(optionId);
  }
}
