import { ConfigService } from '@nestjs/config';

/**
 * Único lugar donde se resuelve el secreto del access token.
 * Solo en NODE_ENV=development|test se permite un valor local; en cualquier otro caso
 * (incluido NODE_ENV sin definir) la app NO arranca sin JWT_SECRET.
 */
export function resolveJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (secret) return secret;
  const env = config.get<string>('NODE_ENV');
  if (env === 'development' || env === 'test') return 'pumaia-dev-only-secret';
  throw new Error(
    'JWT_SECRET no está configurado. La aplicación no puede iniciar.',
  );
}
