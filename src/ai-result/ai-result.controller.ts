import { Controller, Post, Get, UseGuards, Req } from '@nestjs/common';
import { AIResultService } from './ai-result.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('ai-analysis')
@UseGuards(AuthGuard('jwt'))
export class AIResultController {
  constructor(private readonly aiResultService: AIResultService) { }

  @Get('current')
  async getCurrentAnalysis(@Req() req) {
    const studentId = req.user.userId;
    const results = await this.aiResultService.findByStudent(studentId);

    if (!results || results.length === 0) {
      return { hasAnalysis: false, data: null };
    }

    const latest = results[0];
    const parts = latest.descriptionA.split('||');
    const fechaSimulada = new Date().toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    return {
      hasAnalysis: true,
      data: {
        optionA: latest.optionA,
        descriptionA: parts[0],
        meta_summary: parts[1] || '',
        meta_strengths: parts[2] || '',
        meta_opportunities: parts[3] || '',
        optionB: latest.optionB,
        descriptionB: latest.descriptionB,
        optionC: latest.optionC,
        descriptionC: latest.descriptionC,
        optionD: latest.optionD,
        descriptionD: latest.descriptionD,
        optionE: latest.optionE,
        descriptionE: latest.descriptionE,
        createdAt: fechaSimulada
      }
    };
  }

  @Post('generate')
  async generateAnalysis(@Req() req) {
    const studentId = req.user.userId;
    const aiData = await this.aiResultService.processAndSaveAnalysis(studentId);

    const fechaSimulada = new Date().toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    return {
      hasAnalysis: true,
      data: {
        ...aiData,
        createdAt: fechaSimulada
      }
    };
  }
}