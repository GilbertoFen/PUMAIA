import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { PrismaService } from "src/prisma/prisma.service";
import { CreateProfessionalExperienceDto } from './dto/create-professional-experience.dto';
@Injectable()
export class ProfessionalExperienceService {
    constructor(private prisma: PrismaService) { }

    async assign(dto: CreateProfessionalExperienceDto) {
        return await this.prisma.professionalExperience.create({
            data: {
                studentId: dto.studentId,
                areaExpertiseId: dto.areaExpertiseId,
                categoryId: dto.categoryId,
            },
            include: {
                areaExpertise: true,
                student: true,
            },
        });
    }

    async findByStudent(studentId: string) {
        return await this.prisma.professionalExperience.findMany({
            where: { studentId },
            include: {
                areaExpertise: true,
            },
        });
    }
    async update(id: string, dto: { areaExpertiseId?: string; categoryId?: string }) {
        return await this.prisma.professionalExperience.update({
            where: { id },
            data: {
                areaExpertiseId: dto.areaExpertiseId,
                categoryId: dto.categoryId,
            },
            include: {
                areaExpertise: true,
            }
        });
    }
    async parseAndSaveExperience(studentId: string, rawExperienceText: string) {
        try {
            // 1. LLAMADA A TU SERVIDOR DE PYTHON (RENDER)
            // Asumimos que crearás un endpoint /analyze-experience en tu app de Python
            const response = await fetch('https://server-genai.onrender.com/analyze-experience', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ experience_text: rawExperienceText }),
            });

            if (!response.ok) {
                throw new Error(`Error en el servidor de IA de Python: ${response.statusText}`);
            }

            // 2. RECIBIMOS LA RESPUESTA
            // Esperamos que Python devuelva un JSON con esta estructura:
            // { "areaExpertise": "Backend", "categoryEnum": "SISTEMAS_COMPUTACIONALES" }
            const parsedData = await response.json();

            // Validamos que el servidor de Python sí nos mandó lo que esperábamos
            if (!parsedData.areaExpertise || !parsedData.categoryEnum) {
                throw new BadRequestException('El servidor de IA devolvió un formato inválido.');
            }

            // 3. GUARDAMOS EN BASE DE DATOS (Transacción Atómica)
            return await this.prisma.$transaction(async (tx) => {

                // A. Buscamos o creamos el AreaExpertise (ej. "Backend")
                let area = await tx.areaExpertise.findFirst({
                    where: { name: parsedData.areaExpertise }
                });

                if (!area) {
                    area = await tx.areaExpertise.create({
                        data: { name: parsedData.areaExpertise }
                    });
                }

                // B. Buscamos la Categoría Enum exacta en la tabla Category
                const category = await tx.category.findFirst({
                    where: { category: parsedData.categoryEnum }
                });

                if (!category) {
                    throw new BadRequestException(`La IA devolvió una categoría inválida: ${parsedData.categoryEnum}`);
                }

                // C. Creamos la experiencia ligada al alumno
                const newExperience = await tx.professionalExperience.create({
                    data: {
                        studentId: studentId,
                        areaExpertiseId: area.id,
                        categoryId: category.id
                    },
                    include: {
                        areaExpertise: true,
                        category: true
                    }
                });

                return {
                    message: 'Experiencia analizada y guardada con éxito',
                    rawInput: rawExperienceText,
                    aiAnalysis: newExperience
                };
            });

        } catch (error) {
            console.error("Error analizando experiencia:", error);
            throw new InternalServerErrorException('No se pudo procesar la experiencia profesional.');
        }
    }

    async remove(id: string) {
        return await this.prisma.professionalExperience.delete({
            where: { id },
        });
    }
}