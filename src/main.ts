import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api')

  await app.listen(process.env.PORT ?? 3001);

  app.useGlobalPipes(new ValidationPipe());
  console.log("Server is running on port " + (process.env.PORT ?? 3001));
}
bootstrap();
