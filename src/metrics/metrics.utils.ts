import { ConsentKind, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Números
// ---------------------------------------------------------------------------

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Porcentaje 0–100 con 2 decimales; null si no hay base. */
export function pct(part: number, whole: number): number | null {
  return whole > 0 ? round2((part / whole) * 100) : null;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return round2(values.reduce((a, b) => a + b, 0) / values.length);
}

// ---------------------------------------------------------------------------
// Supresión por umbral
// ---------------------------------------------------------------------------

/** Un conteo de alumnos se muestra si es 0 o alcanza el umbral. */
export function visible(students: number, k: number): boolean {
  return students === 0 || students >= k;
}

/**
 * Marca celdas pequeñas (0 < n < k). Si solo hay una celda pequeña y más celdas con datos,
 * también suprime la siguiente más pequeña para que no se pueda deducir por resta del total.
 */
export function suppressSmallCells<K>(
  cells: Map<K, number>,
  k: number,
): Set<K> {
  const small = [...cells.entries()].filter(([, n]) => n > 0 && n < k);
  const suppressed = new Set<K>(small.map(([key]) => key));
  if (small.length === 1) {
    const nextSmallest = [...cells.entries()]
      .filter(([key, n]) => n > 0 && !suppressed.has(key))
      .sort((a, b) => a[1] - b[1])[0];
    if (nextSmallest) suppressed.add(nextSmallest[0]);
  }
  return suppressed;
}

// ---------------------------------------------------------------------------
// Semanas (lunes a domingo, hora de la Ciudad de México)
// ---------------------------------------------------------------------------

/** America/Mexico_City: UTC−6 todo el año (sin horario de verano desde 2022). */
const TZ_OFFSET_MS = -6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Clave de la semana ("YYYY-MM-DD" del lunes local) a la que pertenece un instante. */
export function weekKey(date: Date): string {
  const local = new Date(date.getTime() + TZ_OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  return new Date(local.getTime() - daysSinceMonday * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Instante UTC en que empieza (00:00 local) la semana `key`. */
export function weekStart(key: string): Date {
  return new Date(Date.parse(`${key}T00:00:00Z`) - TZ_OFFSET_MS);
}

/** Las últimas `n` semanas (la actual incluida), de la más vieja a la más reciente. */
export function lastWeeks(
  n: number,
  now = new Date(),
): { keys: string[]; from: Date } {
  const current = Date.parse(`${weekKey(now)}T00:00:00Z`);
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(new Date(current - i * 7 * DAY_MS).toISOString().slice(0, 10));
  }
  return { keys, from: weekStart(keys[0]) };
}

export const DEFAULT_WEEKS = 12;

// ---------------------------------------------------------------------------
// Alumnos registrados y consentimientos
// ---------------------------------------------------------------------------

/** Alumno "registrado": cuenta activa y no eliminada. */
export const REGISTERED_STUDENT = {
  user: { status: UserStatus.ACTIVE, deletedAt: null },
} as const;

export async function loadRegisteredStudents(prisma: PrismaService) {
  return prisma.student.findMany({
    where: REGISTERED_STUDENT,
    select: { id: true, userId: true },
  });
}

/**
 * Estado de cada usuario frente al aviso vigente de un tipo:
 * - CURRENT: su última decisión es aceptar la versión vigente.
 * - REVOKED: su última decisión es rechazar/revocar.
 * - OUTDATED: aceptó una versión anterior del aviso.
 * Los usuarios sin registros no aparecen (= sin respuesta). No escribe en la base.
 */
export type ConsentState = 'CURRENT' | 'REVOKED' | 'OUTDATED';

export async function getConsentStates(
  prisma: PrismaService,
  kind: ConsentKind,
): Promise<{
  noticeVersion: string | null;
  states: Map<string, ConsentState>;
}> {
  const notice = await prisma.privacyNotice.findFirst({
    where: { kind },
    orderBy: { publishedAt: 'desc' },
    select: { id: true, version: true },
  });
  if (!notice) return { noticeVersion: null, states: new Map() };

  const records = await prisma.consentRecord.findMany({
    where: { kind },
    orderBy: { createdAt: 'desc' },
    select: { userId: true, granted: true, noticeId: true },
  });

  const states = new Map<string, ConsentState>();
  for (const r of records) {
    if (states.has(r.userId)) continue; // ya se tomó el más reciente
    states.set(
      r.userId,
      !r.granted
        ? 'REVOKED'
        : r.noticeId === notice.id
          ? 'CURRENT'
          : 'OUTDATED',
    );
  }
  return { noticeVersion: notice.version, states };
}

export function usersWithState(
  states: Map<string, ConsentState>,
  state: ConsentState,
): string[] {
  return [...states.entries()].filter(([, s]) => s === state).map(([u]) => u);
}

/** Periodo pedido, o el que está en curso hoy (por fechas), o null = todos. */
export async function resolvePeriod(
  prisma: PrismaService,
  periodId?: string,
  now = new Date(),
): Promise<{ id: string; code: string } | null> {
  if (periodId) {
    return prisma.academicPeriod.findUnique({
      where: { id: periodId },
      select: { id: true, code: true },
    });
  }
  return prisma.academicPeriod.findFirst({
    where: { startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { startsAt: 'desc' },
    select: { id: true, code: true },
  });
}
