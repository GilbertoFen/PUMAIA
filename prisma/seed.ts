import { PrismaClient, CategoryEnum, KnowledgeAreaEnum } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as pg from 'pg'; 
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const generalPassword = '12345678';
const passwordHash =  bcrypt.hashSync(generalPassword, 10); 


async function main() {
  console.log('1. Limpiar tablas');

  await prisma.grades.deleteMany({});
  await prisma.studentCareer.deleteMany({});
  await prisma.subject.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.address.deleteMany({});
  await prisma.colonia.deleteMany({});
  await prisma.municipio.deleteMany({});
  await prisma.state.deleteMany({});
  await prisma.career.deleteMany({});
  await prisma.studyPlan.deleteMany({});
  await prisma.knowledgeArea.deleteMany({});
  await prisma.category.deleteMany({});

  console.log('2. llenar tablas y enums');
  // 1. Areas de conocimiento - KnowledgeArea
  const areas = await Promise.all([
    prisma.knowledgeArea.create({ data: { knowledgeArea: 'CIENCIAS_FISICO_MATEMATICAS_Y_DE_LAS_INGENIERIAS' } }),
    prisma.knowledgeArea.create({ data: { knowledgeArea: 'CIENCIAS_BIOLOGICAS_Y_DE_LA_SALUD' } }),
    prisma.knowledgeArea.create({ data: { knowledgeArea: 'CIENCIAS_SOCIALES' } }),
    prisma.knowledgeArea.create({ data: { knowledgeArea: 'HUMANIDADES_Y_ARTES' } }),
  ]);
  // 2. Plan de estudios - StudyPlan
  const plan2014 = await prisma.studyPlan.create({
    data: { studyPlan: '2014', semesters: 8 }
  });
  // 3. Carrera -career

  const careerMAC = await prisma.career.create({
    data: {
      name: 'Matemáticas Aplicadas y Computación',
      studyPlanId: plan2014.id,
      knowledgeAreaId: areas[0].id,
      isMasters: false
    }
  });
  //4. Categorias - category
  const categories: Record<string, string> = {};
  const catNames = [
    'MATEMATICAS', 'PROBABILIDAD_ESTADISTICA_Y_OPTIMIZACION',
    'MATEMATICAS_COMPUTACIONALES', 'COMPUTACION', 'HUMANISTICA_SOCIAL',
    'MODELADO_ANALITICO', 'MODELADO_ESTOCASTICO', 'ADMINISTRACION_Y_FINANZAS',
    'SISTEMAS_COMPUTACIONALES', 'CIENCIAS_DE_LA_COMPUTACION'
  ];

  for (const catName of Object.values(CategoryEnum)) {
    const createdCat = await prisma.category.create({ data: { category: catName } });
    categories[catName] = createdCat.id;
  }
  //5. Materias -subjects
  const currentSubjects = [
    { name: 'ALGEBRA SUPERIOR', cat: categories['MATEMATICAS'] },
    { name: 'CALCULO I', cat: categories['MATEMATICAS'] },
    { name: 'ORGANIZACION DE COMPUTADORAS', cat: categories['SISTEMAS_COMPUTACIONALES'] },
    { name: 'PROGRAMACION I', cat: categories['COMPUTACION'] },
    { name: 'SOLUCION ALGORITMICA DE PROBLEMAS', cat: categories['COMPUTACION'] },
    { name: 'LOGICA MATEMATICA', cat: categories['MATEMATICAS_COMPUTACIONALES'] },
    { name: 'ALGEBRA LINEAL', cat: categories['MATEMATICAS'] },
    { name: 'CALCULO II', cat: categories['MATEMATICAS'] },
    { name: 'GEOMETRIA DEL ESPACIO', cat: categories['MATEMATICAS'] },
    { name: 'INGLES INTERMEDIO I', cat: categories['HUMANISTICA_SOCIAL'] },
    { name: 'PROGRAMACION II', cat: categories['COMPUTACION'] },
    { name: 'REDES DE COMPUTO', cat: categories['SISTEMAS_COMPUTACIONALES'] },
    { name: 'CALCULO III', cat: categories['MATEMATICAS'] },
    { name: 'PROGRAMACION ORIENTADA A OBJETOS', cat: categories['COMPUTACION'] },
    { name: 'ESTRUCTURAS DE DATOS', cat: categories['COMPUTACION'] },
    { name: 'INGLES INTERMEDIO II', cat: categories['HUMANISTICA_SOCIAL'] },
    { name: 'METODOS NUMERICOS I', cat: categories['MODELADO_ANALITICO'] },
    { name: 'MATEMATICAS DISCRETAS', cat: categories['MATEMATICAS_COMPUTACIONALES'] },
    { name: 'METODOS NUMERICOS II', cat: categories['MODELADO_ANALITICO'] },
    { name: 'TEORIA DE GRAFICAS', cat: categories['MATEMATICAS_COMPUTACIONALES'] },
    { name: 'BASES DE DATOS', cat: categories['SISTEMAS_COMPUTACIONALES'] },
    { name: 'PROBABILIDAD', cat: categories['PROBABILIDAD_ESTADISTICA_Y_OPTIMIZACION'] },
    { name: 'CALCULO IV', cat: categories['MATEMATICAS'] },
    { name: 'INGLES AVANZADO I', cat: categories['HUMANISTICA_SOCIAL'] },
    { name: 'ECUACIONES DIFERENCIALES I', cat: categories['MATEMATICAS'] },
    { name: 'ESTADISTICA I', cat: categories['PROBABILIDAD_ESTADISTICA_Y_OPTIMIZACION'] },
    { name: 'INGENIERIA DE SOFTWARE', cat: categories['CIENCIAS_DE_LA_COMPUTACION'] },
    { name: 'INGLES AVANZADO II', cat: categories['HUMANISTICA_SOCIAL'] },
    { name: 'OPTIMIZACION I', cat: categories['PROBABILIDAD_ESTADISTICA_Y_OPTIMIZACION'] },
    { name: 'SEMINARIO SOBRE MEXICO ACTUAL', cat: categories['HUMANISTICA_SOCIAL'] },
  ];

  for (const m of currentSubjects) {
    await prisma.subject.create({
      data: { subject: m.name, categoryId: m.cat }
    });
  }
  //6. Direcciones - adresses
  const edo = await prisma.state.create({ data: { name: 'Estado de México' } });
  const mun = await prisma.municipio.create({ data: { name: 'Naucalpan' } });
  const col = await prisma.colonia.create({ data: { name: 'Santa Cruz del Monte' } });

  const direccion = await prisma.address.create({
    data: {
      street: 'Av del chutazo',
      zipCode: 53110,
      coloniaId: col.id,
      municipioId: mun.id,
      stateId: edo.id
    }
  });
  console.log("3. Crear usuarios")
  // 7. Alumnos - student
  const student1 = await prisma.student.create({
    data: {
      accountNumber: 321191399,
      name: 'LUIS GILBERTO',
      lastNameP: 'AVALOS',
      lastNameM: 'VILLALOBOS',
      interest: 'Desarrollo Web',
      currentSemester: 6,
      average: 9,
      email: 'gil@pcpuma.acatlan.com',
      password: passwordHash,
      addressId: direccion.id
    }
  });

  await prisma.studentCareer.create({
    data: { studentId: student1.id, careerId: careerMAC.id, isGraduated: false }
  });

  console.log('---- Seed cargado completo ----');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });