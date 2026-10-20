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
const passwordHash = bcrypt.hashSync(generalPassword, 10);

const studentsData = [
  {
    accountNumber: 100000,
    name: 'SAUL',
    lastNameP: 'CASAS',
    lastNameM: 'LORENZO',
    interest: 'Full Stack Development',
    currentSemester: 6,
    average: 9.2,
    email: '100000@pcpuma.acatlan.com',
  },
  {
    accountNumber: 100001,
    name: 'JOSE EMMANUEL',
    lastNameP: 'ISLAS',
    lastNameM: 'ROMERO',
    interest: 'Ciencia de datos',
    currentSemester: 6,
    average: 8.6,
    email: '100001@pcpuma.acatlan.com',
  },
  {
    accountNumber: 100002,
    name: 'JOAQUIN RACIEL',
    lastNameP: 'RESENDIZ',
    lastNameM: 'RODRIGUEZ',
    interest: 'Ciencia de Datos',
    currentSemester: 6,
    average: 8.8,
    email: '100002@pcpuma.acatlan.com',
  },
  {
    accountNumber: 100003,
    name: 'LUIS GILBERTO',
    lastNameP: 'AVALOS',
    lastNameM: 'VILLALOBOS',
    interest: 'Desarrollo Web',
    currentSemester: 6,
    average: 9.2,
    email: '100003@pcpuma.acatlan.com',
  }
];

async function main() {
  console.log('1. Limpiar tablas');
  await prisma.aIResult.deleteMany({}).catch(() => { });
  await prisma.studentCourse.deleteMany({}).catch(() => { });
  await prisma.studentLanguage.deleteMany({}).catch(() => { });
  await prisma.studentSchoolarship.deleteMany({}).catch(() => { });
  await prisma.studentContest.deleteMany({}).catch(() => { });
  await prisma.professionalExperience.deleteMany({}).catch(() => { });

  await prisma.course.deleteMany({}).catch(() => { });
  await prisma.schoolarship.deleteMany({}).catch(() => { });
  await prisma.contest.deleteMany({}).catch(() => { });
  await prisma.language.deleteMany({}).catch(() => { });
  await prisma.skill.deleteMany({}).catch(() => { });
  await prisma.areaExpertise.deleteMany({}).catch(() => { });

  await prisma.grades.deleteMany({}).catch(() => { });
  await prisma.studentCareer.deleteMany({}).catch(() => { });
  await prisma.subject.deleteMany({}).catch(() => { });
  await prisma.student.deleteMany({}).catch(() => { });
  await prisma.address.deleteMany({}).catch(() => { });
  await prisma.colonia.deleteMany({}).catch(() => { });
  await prisma.municipio.deleteMany({}).catch(() => { });
  await prisma.state.deleteMany({}).catch(() => { });
  await prisma.career.deleteMany({}).catch(() => { });
  await prisma.studyPlan.deleteMany({}).catch(() => { });
  await prisma.knowledgeArea.deleteMany({}).catch(() => { });
  await prisma.category.deleteMany({}).catch(() => { });

  console.log('2. Llenar tablas y enums');

  // 1. Áreas de conocimiento - KnowledgeArea
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

  // 3. Carrera - Career
  const careerMAC = await prisma.career.create({
    data: {
      id: "e1acac76-ad66-458f-b148-906ccec35538",
      name: 'Matemáticas Aplicadas y Computación',
      studyPlanId: plan2014.id,
      knowledgeAreaId: areas[0].id,
      isMasters: false
    }
  });

  // 4. Categorías - Category
  const categories: Record<string, string> = {};

  // Iteramos sobre el Enum real para rellenar la base de datos de forma segura usando la columna 'category'
  for (const catName of Object.values(CategoryEnum)) {
    const createdCat = await prisma.category.create({ data: { category: catName } });
    categories[catName] = createdCat.id;
  }

  // 5. Materias - Subjects
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
    { name: 'ADMINISTRACION DE BASES DE DATOS', cat: categories['SISTEMAS_COMPUTACIONALES'] },
    { name: 'ADMINISTRACION Y SISTEMAS DE CONTABILIDAD', cat: categories['HUMANISTICA_SOCIAL'] },
    { name: 'ANALISIS DE ALGORITMOS', cat: categories['COMPUTACION'] },
    { name: 'ANALISIS DE DECISIONES Y TEORIA DE JUEGOS', cat: categories['PROBABILIDAD_ESTADISTICA_Y_OPTIMIZACION'] },
    { name: 'ELEMENTOS DE FINANZAS E INVERSIONES', cat: categories['MODELADO_ANALITICO'] },
    { name: 'GRAFICACION POR COMPUTADORA', cat: categories['CIENCIAS_DE_LA_COMPUTACION'] },
    { name: 'INVESTIGACION EN MATEMATICAS APLICADAS Y COMPUTACION', cat: categories['HUMANISTICA_SOCIAL'] },
    { name: 'METODOS VARIACIONALES', cat: categories['MODELADO_ANALITICO'] },
    { name: 'PROGRAMACION MULTIMEDIA', cat: categories['CIENCIAS_DE_LA_COMPUTACION'] },
    { name: 'SIMULACION ESTOCASTICA', cat: categories['PROBABILIDAD_ESTADISTICA_Y_OPTIMIZACION'] },
    { name: 'SISTEMAS DINAMICOS', cat: categories['MODELADO_ANALITICO'] },
    { name: 'SISTEMAS INTELIGENTES', cat: categories['CIENCIAS_DE_LA_COMPUTACION'] },
    { name: 'SISTEMAS OPERATIVOS', cat: categories['SISTEMAS_COMPUTACIONALES'] },
    { name: 'TEMAS SELECTOS DE COMPUTACION I', cat: categories['COMPUTACION'] },
    { name: 'TEMAS SELECTOS DE ESTADISTICA', cat: categories['PROBABILIDAD_ESTADISTICA_Y_OPTIMIZACION'] },
    { name: 'TEMAS SELECTOS DE MATEMATICAS I', cat: categories['MATEMATICAS'] },
    { name: 'DESARROLLO WEB', cat: categories['CIENCIAS_DE_LA_COMPUTACION'] },
    { name: 'ECUACIONES DIFERENCIALES II', cat: categories['MATEMATICAS'] },
    { name: 'ESTADISTICA II', cat: categories['PROBABILIDAD_ESTADISTICA_Y_OPTIMIZACION'] },
    { name: 'OPTIMIZACION II', cat: categories['PROBABILIDAD_ESTADISTICA_Y_OPTIMIZACION'] },
    { name: 'PROCESOS ESTOCASTICOS', cat: categories['PROBABILIDAD_ESTADISTICA_Y_OPTIMIZACION'] },
    { name: 'SEMINARIO SOBRE ETICA Y RESPONSABILIDAD SOCIAL', cat: categories['HUMANISTICA_SOCIAL'] },
    { name: 'SEM. SOBRE ETICA Y RESPONSAB. SOCIAL', cat: categories['HUMANISTICA_SOCIAL'] },
  ];

  for (const m of currentSubjects) {
    await prisma.subject.create({
      data: { subject: m.name, categoryId: m.cat }
    });
  }

  // 6. Direcciones - Addresses
  const edo = await prisma.state.create({ data: { name: 'Estado de México' } });
  const mun = await prisma.municipio.create({ data: { name: 'Naucalpan' } });
  const col = await prisma.colonia.create({ data: { name: 'Santa Cruz del Monte' } });

  const direccion = await prisma.address.create({
    data: {
      id: "391ced55-1955-400c-b93d-7328e6672d33",
      street: 'Av del chutazo',
      zipCode: 53110,
      coloniaId: col.id,
      municipioId: mun.id,
      stateId: edo.id
    }
  });

  const catIADesarrollo = await prisma.aICategory.create({
    data: { name: 'Perfil Orientado al Desarrollo de Sistemas y Software' }
  });
  await prisma.aICategory.create({
    data: { name: 'Perfil Analítico y Ciencia de Datos' }
  });
  await prisma.aICategory.create({
    data: { name: 'Perfil de Optimización e Investigación de Operaciones' }
  });

  console.log("3. Crear usuarios");
  // 7. Alumnos - Student
  for (const studentData of studentsData) {
    const newStudent = await prisma.student.create({
      data: {
        ...studentData,
        password: passwordHash,
        addressId: direccion.id
      }
    });

    await prisma.studentCareer.create({
      data: {
        studentId: newStudent.id,
        careerId: careerMAC.id,
        isGraduated: false
      }
    });
  }

  console.log("4. Sembrar Catálogos Adicionales (Cursos, Becas, Concursos, Idiomas)");
  const courses = [
    { name: 'Curso de programación en C y C++', category: 'COMPUTACION' },
    { name: 'Curso de desarrollo web frontend con React', category: 'COMPUTACION' },
    { name: 'Curso de desarrollo backend con Node.js', category: 'SISTEMAS_COMPUTACIONALES' },
    { name: 'Curso de bases de datos y SQL', category: 'SISTEMAS_COMPUTACIONALES' },
    { name: 'Curso de estructuras de datos y algoritmos', category: 'COMPUTACION' },
    { name: 'Curso de programación en Python para ciencia de datos', category: 'CIENCIAS_DE_LA_COMPUTACION' },
    { name: 'Curso de inteligencia artificial y machine learning', category: 'CIENCIAS_DE_LA_COMPUTACION' },
    { name: 'Curso de ciberseguridad y redes', category: 'SISTEMAS_COMPUTACIONALES' },
    { name: 'Curso de administración de proyectos de software', category: 'SISTEMAS_COMPUTACIONALES' },
    { name: 'Curso de matemáticas discretas', category: 'MATEMATICAS' },
    { name: 'Curso de estadística inferencial y probabilidad', category: 'PROBABILIDAD_ESTADISTICA_Y_OPTIMIZACION' },
    { name: 'Curso de optimización lineal y no lineal', category: 'PROBABILIDAD_ESTADISTICA_Y_OPTIMIZACION' },
    { name: 'Curso de computación en la nube (Cloud Computing)', category: 'SISTEMAS_COMPUTACIONALES' },
    { name: 'Curso de desarrollo de aplicaciones móviles', category: 'COMPUTACION' },
    { name: 'Curso de análisis financiero y modelos económicos', category: 'ADMINISTRACION_Y_FINANZAS' }
  ];

  for (const course of courses) {
    await prisma.course.create({
      data: { name: course.name, categoryId: categories[course.category] },
    });
  }


  // 1. Becas existentes
  await prisma.schoolarship.create({
    data: {
      name: 'Beca de Excelencia Académica UNAM',
      categoryId: categories['HUMANISTICA_SOCIAL'],
    },
  });
  await prisma.schoolarship.create({
    data: {
      name: 'Beca Santander Movilidad Internacional',
      categoryId: categories['ADMINISTRACION_Y_FINANZAS'],
    },
  });
  await prisma.schoolarship.create({
    data: {
      name: 'Beca de Conectividad y Apoyo Nutricional FES Acatlán',
      categoryId: categories['HUMANISTICA_SOCIAL'],
    },
  });

  // 2. Nuevas becas extraídas del documento
  const nuevasBecas = [
    { name: 'Beca Manutención UNAM', cat: 'HUMANISTICA_SOCIAL' },
    { name: 'Beca Santander Universitaria', cat: 'ADMINISTRACION_Y_FINANZAS' },
    { name: 'Beca de fortalecimiento académico de los estudios de licenciatura y de alta exigencia academica', cat: 'HUMANISTICA_SOCIAL' },
    { name: 'Beca para disminuir el bajo rendimiento academico', cat: 'HUMANISTICA_SOCIAL' },
    { name: 'Beca para apoyo a grupos vulnerables provenientes de zonas marginadas del pais', cat: 'HUMANISTICA_SOCIAL' }
  ];

  for (const beca of nuevasBecas) {
    await prisma.schoolarship.create({
      data: {
        name: beca.name,
        categoryId: categories[beca.cat],
      },
    });
  }


  // ─────────────────────────────────────────────────────────
  // C. CONCURSOS GLOBALES
  // ─────────────────────────────────────────────────────────
  const contests = [
    { name: 'Hackathon de desarrollo web', category: 'COMPUTACION' },
    { name: 'Hackathon de aplicaciones móviles', category: 'COMPUTACION' },
    { name: 'Concurso de programación competitiva', category: 'COMPUTACION' },
    { name: 'Datathon de ciencia de datos', category: 'PROBABILIDAD_ESTADISTICA_Y_OPTIMIZACION' },
    { name: 'Concurso de seguridad informática (CTF)', category: 'SISTEMAS_COMPUTACIONALES' },
    { name: 'Hackathon de inteligencia artificial', category: 'CIENCIAS_DE_LA_COMPUTACION' },
    { name: 'Concurso de modelos matemáticos aplicados', category: 'MATEMATICAS' },
    { name: 'Hackathon de automatización y robótica', category: 'SISTEMAS_COMPUTACIONALES' },
    { name: 'Concurso de gestión financiera y emprendimiento', category: 'ADMINISTRACION_Y_FINANZAS' },
    { name: 'Hackathon de soluciones tecnológicas sustentables', category: 'SISTEMAS_COMPUTACIONALES' }
  ];

  for (const contest of contests) {
    await prisma.contest.create({
      data: { name: contest.name, categoryId: categories[contest.category] },
    });
  }
  // ─────────────────────────────────────────────────────────
  // D. IDIOMAS GLOBALES
  // ─────────────────────────────────────────────────────────
  const languages = ['Inglés', 'Alemán', 'Francés', 'Portugués', 'Español', 'Japonés', 'Chino'];

  for (const lang of languages) {
    await prisma.language.create({
      data: { name: lang },
    });
  }
  // ─────────────────────────────────────────────────────────
  // E. SKILLS / NIVELES CEFR
  // ─────────────────────────────────────────────────────────
  await prisma.skill.create({
    data: { id: 'A1', proficiency: 'A1' },
  });
  await prisma.skill.create({
    data: { id: 'A2', proficiency: 'A2' },
  });
  await prisma.skill.create({
    data: { id: 'B1', proficiency: 'B1' },
  });
  await prisma.skill.create({
    data: { id: 'B2', proficiency: 'B2' },
  });
  await prisma.skill.create({
    data: { id: 'C1', proficiency: 'C1' },

  });
  await prisma.skill.create({
    data: { id: 'C2', proficiency: 'C2' },
  });

  // ─────────────────────────────────────────────────────────
  // F. ÁREAS DE EXPERTISE
  // ─────────────────────────────────────────────────────────
  const areasExp = [
    'Desarrollo Backend e Infraestructura',
    'Ciberseguridad y Auditoría de Sistemas',
    'Ingeniería de Datos y Pipelines NLP',
    'Inteligencia Artificial y Machine Learning',
    'Desarrollo Frontend y Experiencia de Usuario',
    'Análisis de Datos y Business Intelligence',
    'Arquitectura de Nube (Cloud Computing)',
    'DevOps y Automatización de Procesos',
    'Ciencia de Datos y Estadística Aplicada',
    'Gestión de Proyectos Tecnológicos (Agile)',
    'Desarrollo de Aplicaciones Móviles',
    'Blockchain y Tecnologías Distribuidas',
    'Administración de Bases de Datos',
    'Consultoría Tecnológica y Transformación Digital',
    'Investigación de Operaciones y Optimización'
  ];

  for (const area of areasExp) {
    await prisma.areaExpertise.create({
      data: { name: area },
    });
  }
  console.log('---- Seed cargado completo y en verde ----');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });