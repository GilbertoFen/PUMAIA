import { PrismaClient, CategoryEnum } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('ERROR: No se encontró DATABASE_URL ni DIRECT_URL en el entorno.');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export async function seedCatalogs() {
  console.log('--- Iniciando población de catálogos oficiales de PumaIA ---');

  // 1. Obtener categorías existentes
  const categories = await prisma.category.findMany();
  const categoryMap = new Map<CategoryEnum, string>();
  for (const c of categories) {
    categoryMap.set(c.category as CategoryEnum, c.id);
  }

  // Asegurar que existan todas las categorías del enum
  const allEnums = Object.values(CategoryEnum);
  for (const catEnum of allEnums) {
    if (!categoryMap.has(catEnum)) {
      const created = await prisma.category.create({
        data: { category: catEnum },
      });
      categoryMap.set(catEnum, created.id);
    }
  }

  const getCatId = (catEnum: CategoryEnum): string => {
    const id = categoryMap.get(catEnum);
    if (!id) throw new Error(`Categoría ${catEnum} no encontrada.`);
    return id;
  };

  // ═════════════════════════════════════════════════════════════════════════
  // 2. IDIOMAS (Language)
  // ═════════════════════════════════════════════════════════════════════════
  const languagesData = [
    'Español',
    'Inglés',
    'Francés',
    'Alemán',
    'Italiano',
    'Portugués',
    'Japonés',
    'Chino Mandarín',
    'Ruso',
  ];

  console.log(`Poblando ${languagesData.length} idiomas...`);
  for (const lang of languagesData) {
    await prisma.language.upsert({
      where: { name: lang },
      update: {},
      create: { name: lang },
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 3. NIVELES DE DOMINIO / HABILIDADES (Skill)
  // ═════════════════════════════════════════════════════════════════════════
  const skillsData = [
    'A1',
    'A2',
    'B1',
    'B2',
    'C1',
    'C2',
    'Nativo',
  ];

  console.log(`Poblando ${skillsData.length} niveles de idioma (Skill)...`);
  for (const skill of skillsData) {
    await prisma.skill.upsert({
      where: { proficiency: skill },
      update: {},
      create: { proficiency: skill },
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 4. ÁREAS DE ESPECIALIZACIÓN (AreaExpertise)
  // ═════════════════════════════════════════════════════════════════════════
  const areasData = [
    'Desarrollo de Software',
    'Ciencia de Datos y Analítica',
    'Inteligencia Artificial y Machine Learning',
    'Bases de Datos y Modelado de Información',
    'Ciberseguridad y Seguridad de la Información',
    'Redes e Infraestructura de Comunicaciones',
    'Cloud Computing y DevOps',
    'Desarrollo Móvil',
    'Computación Gráfica y Videojuegos',
    'Optimización e Investigación de Operaciones',
    'Finanzas Cuantitativas y Modelado Financiero',
    'Sistemas Distribuidos y Cómputo Concurrente',
  ];

  console.log(`Poblando ${areasData.length} áreas de expertise...`);
  for (const area of areasData) {
    const existing = await prisma.areaExpertise.findFirst({
      where: { name: { equals: area, mode: 'insensitive' } },
    });
    if (!existing) {
      await prisma.areaExpertise.create({
        data: { name: area },
      });
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 5. CURSOS OFICIALES (Course)
  // ═════════════════════════════════════════════════════════════════════════
  const coursesData: { name: string; category: CategoryEnum }[] = [
    // Computación & Sistemas
    {
      name: 'Python para todos: Exploración de datos (UNAM · Coursera)',
      category: CategoryEnum.COMPUTACION,
    },
    {
      name: 'Programación en Java: De los fundamentos al desarrollo orientado a objetos (UNAM · Coursera)',
      category: CategoryEnum.COMPUTACION,
    },
    {
      name: 'Desarrollo Web Profesional con HTML5, CSS3 y JavaScript (FES Acatlán · UNAM)',
      category: CategoryEnum.SISTEMAS_COMPUTACIONALES,
    },
    {
      name: 'Estructuras de Datos y Algoritmos en C++ (edX · UNAM)',
      category: CategoryEnum.CIENCIAS_DE_LA_COMPUTACION,
    },
    {
      name: 'Google Cybersecurity Certificate (Google Career Certificates)',
      category: CategoryEnum.SISTEMAS_COMPUTACIONALES,
    },
    {
      name: 'CCNA: Introduction to Networks (Cisco Networking Academy)',
      category: CategoryEnum.COMPUTACION,
    },
    {
      name: 'AWS Cloud Solutions Architect: Cloud Foundations (Amazon Web Services)',
      category: CategoryEnum.SISTEMAS_COMPUTACIONALES,
    },
    {
      name: 'Microsoft Certified: Azure Fundamentals AZ-900 (Microsoft Learn)',
      category: CategoryEnum.SISTEMAS_COMPUTACIONALES,
    },
    {
      name: 'IBM SkillsBuild: Fundamentos de Inteligencia Artificial (IBM SkillsBuild)',
      category: CategoryEnum.CIENCIAS_DE_LA_COMPUTACION,
    },
    {
      name: 'Docker y Kubernetes: Arquitectura de Contenedores y Microservicios (Linux Foundation)',
      category: CategoryEnum.SISTEMAS_COMPUTACIONALES,
    },
    // Ciencia de datos, Modelado & Estadística
    {
      name: 'Ciencia de Datos con R y Python (UNAM · Coursera)',
      category: CategoryEnum.PROBABILIDAD_ESTADISTICA_Y_OPTIMIZACION,
    },
    {
      name: 'Machine Learning Specialization: Supervised & Unsupervised Learning (DeepLearning.AI · Stanford)',
      category: CategoryEnum.CIENCIAS_DE_LA_COMPUTACION,
    },
    {
      name: 'Estadística Aplicada y Análisis Multivariado para la Toma de Decisiones (edX)',
      category: CategoryEnum.PROBABILIDAD_ESTADISTICA_Y_OPTIMIZACION,
    },
    {
      name: 'Optimización Matemática y Programación Lineal con Solver y Python (FES Acatlán · UNAM)',
      category: CategoryEnum.PROBABILIDAD_ESTADISTICA_Y_OPTIMIZACION,
    },
    // Matemáticas y Computación Aplicada
    {
      name: 'Cálculo Diferencial e Integral Aplicado a la Computación (UNAM)',
      category: CategoryEnum.MATEMATICAS,
    },
    {
      name: 'Álgebra Lineal y Computacional con NumPy y SciPy (UNAM)',
      category: CategoryEnum.MATEMATICAS_COMPUTACIONALES,
    },
    {
      name: 'Métodos Numéricos para Ecuaciones Diferenciales y Modelado Matemático (UNAM)',
      category: CategoryEnum.MODELADO_ANALITICO,
    },
    {
      name: 'Matemáticas Discretas y Lógica para Ciencias de la Computación (Coursera)',
      category: CategoryEnum.MATEMATICAS_COMPUTACIONALES,
    },
    // Administración y Finanzas
    {
      name: 'Matemáticas Financieras y Valuación de Instrumentos de Inversión (UNAM)',
      category: CategoryEnum.ADMINISTRACION_Y_FINANZAS,
    },
    {
      name: 'Gestión de Proyectos de Software con Metodologías Ágiles y Scrum (Google · Coursera)',
      category: CategoryEnum.ADMINISTRACION_Y_FINANZAS,
    },
  ];

  console.log(`Poblando ${coursesData.length} cursos oficiales...`);
  for (const c of coursesData) {
    const catId = getCatId(c.category);
    const existing = await prisma.course.findFirst({
      where: { name: c.name },
    });
    if (!existing) {
      await prisma.course.create({
        data: {
          name: c.name,
          categoryId: catId,
        },
      });
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 6. CONCURSOS Y COMPETENCIAS OFICIALES (Contest)
  // ═════════════════════════════════════════════════════════════════════════
  const contestsData: { name: string; category: CategoryEnum }[] = [
    {
      name: 'ICPC: International Collegiate Programming Contest (Gran Premio de México)',
      category: CategoryEnum.CIENCIAS_DE_LA_COMPUTACION,
    },
    {
      name: 'Hackathon UNAM Acatlán (FES Acatlán · Convocatoria Anual)',
      category: CategoryEnum.SISTEMAS_COMPUTACIONALES,
    },
    {
      name: 'Kaggle Competitions: Global Data Science & ML Challenges',
      category: CategoryEnum.PROBABILIDAD_ESTADISTICA_Y_OPTIMIZACION,
    },
    {
      name: 'IEEEXtreme Programming Competition (IEEE Student Branch)',
      category: CategoryEnum.COMPUTACION,
    },
    {
      name: 'HackDef CTF: Torneo Universitario Nacional de Ciberseguridad',
      category: CategoryEnum.SISTEMAS_COMPUTACIONALES,
    },
    {
      name: 'HackMTY: Hackathon Estudiantil de Software e Innovación',
      category: CategoryEnum.SISTEMAS_COMPUTACIONALES,
    },
    {
      name: 'Concurso Nacional de Programación ANIEI',
      category: CategoryEnum.CIENCIAS_DE_LA_COMPUTACION,
    },
    {
      name: 'Data Challenge UNAM: Retos de Analítica y Modelado de Datos',
      category: CategoryEnum.PROBABILIDAD_ESTADISTICA_Y_OPTIMIZACION,
    },
    {
      name: 'Competencia Iberoamericana Interuniversitaria de Matemáticas (CIIM)',
      category: CategoryEnum.MATEMATICAS,
    },
    {
      name: 'Premio Santander X a la Innovación y Emprendimiento Tecnológico',
      category: CategoryEnum.ADMINISTRACION_Y_FINANZAS,
    },
    {
      name: 'Hult Prize UNAM: Emprendimiento de Impacto Global',
      category: CategoryEnum.HUMANISTICA_SOCIAL,
    },
  ];

  console.log(`Poblando ${contestsData.length} concursos oficiales...`);
  for (const cn of contestsData) {
    const catId = getCatId(cn.category);
    const existing = await prisma.contest.findFirst({
      where: { name: cn.name },
    });
    if (!existing) {
      await prisma.contest.create({
        data: {
          name: cn.name,
          categoryId: catId,
        },
      });
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 7. BECAS OFICIALES (Schoolarship)
  // ═════════════════════════════════════════════════════════════════════════
  const scholarshipsData: { name: string; category: CategoryEnum }[] = [
    {
      name: 'Beca de Excelencia Bécalos UNAM (Fundación Televisa / UNAM)',
      category: CategoryEnum.HUMANISTICA_SOCIAL,
    },
    {
      name: 'Beca de Manutención Santander - UNAM',
      category: CategoryEnum.ADMINISTRACION_Y_FINANZAS,
    },
    {
      name: 'Beca de Conectividad y Dispositivos Electrónicos UNAM',
      category: CategoryEnum.COMPUTACION,
    },
    {
      name: 'Beca de Iniciación a la Investigación Científica y Tecnológica (FES Acatlán)',
      category: CategoryEnum.CIENCIAS_DE_LA_COMPUTACION,
    },
    {
      name: 'Beca de Apoyo Nutricional FES Acatlán · UNAM',
      category: CategoryEnum.HUMANISTICA_SOCIAL,
    },
  ];

  console.log(`Poblando ${scholarshipsData.length} becas oficiales...`);
  for (const b of scholarshipsData) {
    const catId = getCatId(b.category);
    const existing = await prisma.schoolarship.findFirst({
      where: { name: b.name },
    });
    if (!existing) {
      await prisma.schoolarship.create({
        data: {
          name: b.name,
          categoryId: catId,
        },
      });
    }
  }

  console.log('--- Población de catálogos completada exitosamente sin duplicados ---');
}

if (require.main === module) {
  seedCatalogs()
    .catch((e) => {
      console.error('Error durante la ejecución del seed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

