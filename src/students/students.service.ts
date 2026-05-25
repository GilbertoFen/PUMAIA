import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import * as bcrypt from 'bcrypt';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { ConflictException } from '@nestjs/common';
@Injectable()
export class StudentsService {
    constructor(private prisma: PrismaService, private cloudinary: CloudinaryService) { }

    async findAll() {
        try {
            console.log('1. Buscando todos los estudiantes...');
            const result = await this.prisma.student.findMany();
            console.log('2. Estudiantes encontrados:', result);
            return result;
        } catch (error) {
            console.error('ERROR EN PRISMA:', error);
            throw error;
        }
    }

    async create(dto: CreateStudentDto) {
        // 1. Validar que no exista la cuenta o el correo
        const existingStudent = await this.prisma.student.findFirst({
            where: {
                OR: [
                    { accountNumber: dto.accountNumber },
                    { email: dto.email }
                ]
            }
        });

        if (existingStudent) {
            throw new ConflictException('El número de cuenta o correo ya están registrados.');
        }

        const salt = await bcrypt.genSalt();
        const hashedPassword = await bcrypt.hash(dto.password, salt);

        // 2. Crear al estudiante. 
        // Asumiendo que tu modelo Prisma relaciona Student con Career mediante una tabla pivote 'StudentCareer'
        // Si tu relación es directa, simplemente añade el careerId o el string.
        return this.prisma.student.create({
            data: {
                accountNumber: dto.accountNumber,
                name: dto.name,
                lastNameP: dto.lastNameP,
                lastNameM: dto.lastNameM,
                interest: dto.interest,
                currentSemester: dto.currentSemester,
                average: dto.average,
                email: dto.email,
                password: hashedPassword,
                addressId: dto.addressId,

                // 🔥 Inyectamos MAC por defecto. 
                // Asegúrate de que el id 'MAC_UUID' sea el ID real de MAC en tu tabla Career.
                // Si guardas la carrera como un simple String en Student, sería: career: "Matemáticas Aplicadas y Computación"
                // ... los otros campos
                careers: {
                    create: {
                        isGraduated: false, // <-- LÍNEA FALTANTE (Agrega esto)
                        career: {
                            connect: { id: "e1acac76-ad66-458f-b148-906ccec35538" }
                        }
                    }
                }
            }
        });
    }
    async findByAccountNumber(accountNumber: number) {
        const result = await this.prisma.student.findUnique({
            where: { accountNumber },
            include: {
                careers: {
                    include: {
                        career: true
                    }
                }
            }
        });
        console.log('Resultado de Prisma:', JSON.stringify(result, null, 2));
        return result;
    }

    async findByEmail(email: string) {
        return await this.prisma.student.findUnique({
            where: { email }
        });
    }


    async assignContest(studentId: string, contestId: string) {
        try {
            return await this.prisma.studentContest.create({
                data: {
                    studentId: studentId,
                    contestId: contestId,
                },
                include: {
                    contest: true
                }
            });
        } catch (error) {
            console.error("Error al asignar concurso:", error);
            throw error;
        }
    }
    // En tu student.service.ts (o el servicio que maneje el perfil del alumno)
    async updateInterests(studentId: string, interest: string) {
        return await this.prisma.student.update({
            where: {
                id: studentId
            },
            data: {
                interest: interest.trim(), // Insertamos el string crudo tal cual llegó
            },
            select: {
                id: true,
                interest: true
            }
        });
    }
    async getFullProfileSummary(studentId: string) {
        // 1. Traemos el perfil completo incluyendo la relación "grades"
        const profile = await this.prisma.student.findUnique({
            where: { id: studentId },
            include: {
                courses: { include: { course: true } },
                languages: { include: { language: true, skill: true } },
                schoolarships: { include: { schoolarship: true } },
                contests: { include: { contest: true } },
                experiences: { include: { areaExpertise: true } },
                answers: true,
                
                // 🔥 AQUÍ ESTÁ LA CLAVE: Incluimos tus calificaciones y la materia
                grades: { include: { subject: true } } 
            }
        });

        if (!profile) return null;

        // 2. Calculamos el promedio dinámico iterando sobre 'grades'
        let dynamicAverage = 0;
        
        if (profile.grades && profile.grades.length > 0) {
            const sum = profile.grades.reduce((acc, currentGrade) => {
                // Sumamos el valor de la columna 'grade' de tu modelo 'Grades'
                return acc + Number(currentGrade.grade || 0); 
            }, 0);
            
            dynamicAverage = sum / profile.grades.length;
        }

        // 3. Sobrescribimos el promedio estático y devolvemos
        return {
            ...profile,
            average: parseFloat(dynamicAverage.toFixed(2)) // Redondeamos a 2 decimales
        };
    }
    async uploadAvatar(studentId: string, file: Express.Multer.File) {
        if (!file) throw new Error('No se recibió ninguna imagen.');

        // 1. Subimos la imagen a la nube
        const result = await this.cloudinary.uploadImage(file);

        // 2. Guardamos la URL segura en la base de datos
        return this.prisma.student.update({
            where: { id: studentId },
            data: { avatarUrl: result.secure_url },
            select: { id: true, avatarUrl: true }
        });
    }
    async removeContest(relationId: string) {
        try {
            return await this.prisma.studentContest.delete({
                where: { id: relationId }
            });
        } catch (error) {
            console.error("Error al eliminar relación concurso-alumno:", error);
            throw error;
        }
    }

}
