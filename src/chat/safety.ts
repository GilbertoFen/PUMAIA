/**
 * Detección de seguridad del chat. Determinista (sin LLM) a propósito:
 * la respuesta a una crisis no puede depender de un proveedor externo ni de que n8n esté arriba.
 */

export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Riesgo inmediato: se responde con el mensaje fijo de crisis y NO se envía a n8n.
const CRISIS_PATTERNS: RegExp[] = [
  /\bsuicid/,
  /\bautolesi/,
  /\bquitarme la vida\b/,
  /\bquitarse la vida\b/,
  /\bacabar con mi vida\b/,
  /\bterminar con mi vida\b/,
  /\bacabar con todo\b/,
  /\bme quiero matar\b/,
  /\bme voy a matar\b/,
  /\bquiero morir(me)?\b/,
  /\bquisiera morir(me)?\b/,
  /\bno quiero (seguir )?viv(ir|iendo)\b/,
  /\bya no quiero estar aqui\b/,
  /\bno vale la pena (seguir )?viv(ir|iendo)\b/,
  /\bmejor (estaria|estar) muert[oa]\b/,
  /\bhacerme dano\b/,
  /\blastimarme\b/,
  /\bcortarme (las venas|los brazos|las munecas|para)\b/,
];

// Tema sensible: la conversación se marca `sensitive` (excluida de analítica y mejora), pero sigue su curso.
const SENSITIVE_PATTERNS: RegExp[] = [
  /\bcrisis de ansiedad\b/,
  /\bataque(s)? de panico\b/,
  /\bdepresion\b/,
  /\bdeprimid[oa]\b/,
  /\bansiedad\b/,
  /\babuso\b/,
  /\bviolencia\b/,
  /\bacoso\b/,
  /\bhostigamiento\b/,
  /\bme golpe(a|an|o)\b/,
  /\bapoyo psicologico\b/,
  /\bpsicologo\b/,
  /\bterapia\b/,
  /\bautoestima\b/,
  /\bme siento (muy )?(solo|sola|mal|vacio|vacia)\b/,
  /\bno puedo mas\b/,
];

export function detectCrisis(content: string): boolean {
  const t = normalizeText(content);
  return !!t && CRISIS_PATTERNS.some((p) => p.test(t));
}

export function detectSensitive(content: string): boolean {
  const t = normalizeText(content);
  if (!t) return false;
  return detectCrisis(content) || SENSITIVE_PATTERNS.some((p) => p.test(t));
}

/**
 * Mensaje fijo de crisis. Los teléfonos son configurables por entorno para poder corregirlos sin desplegar.
 * VERIFICAR los números vigentes antes de producción.
 */
export function buildCrisisResponse(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const lines = [
    `Línea de la Vida: ${env.CRISIS_LINEA_VIDA || '800 911 2000'} (gratuita, atiende todos los días)`,
    `SAPTEL: ${env.CRISIS_SAPTEL || '55 5259 8121'}`,
    'Emergencias: 911',
  ];
  if (env.CRISIS_UNAM_RESOURCE) lines.push(env.CRISIS_UNAM_RESOURCE);

  return [
    'Gracias por contarme esto; lo que sientes importa y no tienes que pasarlo solo/a.',
    'Si estás en peligro o piensas hacerte daño ahora mismo, llama al 911 o acude a la persona o lugar seguro más cercano.',
    'Estas líneas te pueden escuchar ahora:',
    ...lines.map((l) => `• ${l}`),
    'Si puedes, avísale hoy a alguien de confianza (familia, amistad o alguien cerca de ti) para que te acompañe.',
    'Aquí sigo para platicar con calma, y si quieres puedo ayudarte a buscar apoyo psicológico dentro de la universidad.',
  ].join('\n');
}
