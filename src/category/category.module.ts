import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';



@Module({
    controllers: [CategoryController],
    providers: [CategoryService],
    imports: [PrismaModule]
})

export class CategoryModule {}