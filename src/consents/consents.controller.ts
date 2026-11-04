import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { ConsentsService } from './consents.service';
import { RecordConsentDto, BatchConsentDto } from './dto/record-consent.dto';

@Controller('consents')
export class ConsentsController {
  constructor(private readonly consentsService: ConsentsService) {}

  /**
   * Endpoint público: obtiene los avisos de privacidad activos para que el cliente los muestre.
   */
  @Get('notices')
  getActiveNotices() {
    return this.consentsService.getActivePrivacyNotices();
  }

  /**
   * Endpoint protegido: consulta el estado actual de los consentimientos del usuario autenticado.
   */
  @UseGuards(JwtAuthGuard)
  @Get('status')
  getMyConsentStatus(@Req() req: any) {
    return this.consentsService.getUserConsentStatus(req.user.userId);
  }

  /**
   * Endpoint protegido: consulta el historial inmutable de consentimientos del usuario.
   */
  @UseGuards(JwtAuthGuard)
  @Get('history')
  getMyConsentHistory(@Req() req: any) {
    return this.consentsService.getUserConsentHistory(req.user.userId);
  }

  /**
   * Endpoint protegido: registra un consentimiento individual (append-only).
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  recordConsent(@Req() req: any, @Body() dto: RecordConsentDto) {
    return this.consentsService.recordConsent(req.user.userId, dto);
  }

  /**
   * Endpoint protegido: registra consentimientos en lote (ej. en el primer login/onboarding).
   */
  @UseGuards(JwtAuthGuard)
  @Post('batch')
  recordBatchConsents(@Req() req: any, @Body() dto: BatchConsentDto) {
    return this.consentsService.recordBatchConsents(req.user.userId, dto.consents);
  }
}

