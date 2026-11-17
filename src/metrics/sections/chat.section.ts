import {
  ConsentKind,
  FeedbackValue,
  RolMensaje,
  TopicGroup,
} from '@prisma/client';
import { SectionContext } from './context';
import {
  getConsentStates,
  lastWeeks,
  pct,
  usersWithState,
  visible,
  weekKey,
} from '../metrics.utils';

/**
 * Chat. Todo sale solo de conversaciones NO sensibles de alumnos con ANALYTICS vigente.
 * - Temas agrupados por topicGroup (conversaciones distintas por tema y por grupo).
 * - Consultas por semana (mensajes del alumno).
 * - Feedback útil (UP) vs no útil (DOWN), total y por semana.
 * Nunca se devuelve contenido de mensajes.
 */
export async function getChat(ctx: SectionContext, filters: { weeks: number }) {
  const { prisma, k } = ctx;
  const { noticeVersion, states } = await getConsentStates(
    prisma,
    ConsentKind.ANALYTICS,
  );
  const eligible = usersWithState(states, 'CURRENT');
  const conversationWhere = {
    sensitive: false,
    student: { userId: { in: eligible } },
  };
  const { keys, from } = lastWeeks(filters.weeks, ctx.now);

  const [eligibleConversations, labels, messages, feedback] = await Promise.all(
    [
      prisma.conversation.count({ where: conversationWhere }),
      prisma.conversationLabel.findMany({
        where: { conversation: conversationWhere },
        select: {
          conversationId: true,
          conversation: { select: { studentId: true } },
          topic: { select: { code: true, label: true, topicGroup: true } },
        },
      }),
      prisma.message.findMany({
        where: {
          role: RolMensaje.USER,
          createdAt: { gte: from },
          conversation: conversationWhere,
        },
        select: {
          createdAt: true,
          conversation: { select: { studentId: true } },
        },
      }),
      prisma.messageFeedback.findMany({
        where: { message: { conversation: conversationWhere } },
        select: {
          value: true,
          createdAt: true,
          message: {
            select: { conversation: { select: { studentId: true } } },
          },
        },
      }),
    ],
  );

  // Temas por grupo
  type Acc = { conversations: Set<string>; students: Set<string> };
  const newAcc = (): Acc => ({ conversations: new Set(), students: new Set() });
  const groups = new Map<
    TopicGroup,
    Acc & { topics: Map<string, Acc & { label: string }> }
  >();
  for (const g of Object.values(TopicGroup)) {
    groups.set(g, { ...newAcc(), topics: new Map() });
  }
  const labeled = new Set<string>();
  for (const l of labels) {
    labeled.add(l.conversationId);
    const g = groups.get(l.topic.topicGroup)!;
    g.conversations.add(l.conversationId);
    g.students.add(l.conversation.studentId);
    if (!g.topics.has(l.topic.code)) {
      g.topics.set(l.topic.code, { ...newAcc(), label: l.topic.label });
    }
    const t = g.topics.get(l.topic.code)!;
    t.conversations.add(l.conversationId);
    t.students.add(l.conversation.studentId);
  }
  const shown = (a: Acc) => visible(a.students.size, k);
  const topicsByGroup = [...groups.entries()]
    .map(([topicGroup, g]) => ({
      topicGroup,
      conversations: shown(g) ? g.conversations.size : null,
      topics: [...g.topics.entries()]
        .map(([code, t]) => ({
          topicCode: code,
          label: t.label,
          conversations: shown(t) ? t.conversations.size : null,
        }))
        .sort((a, b) => (b.conversations ?? -1) - (a.conversations ?? -1)),
    }))
    .sort((a, b) => (b.conversations ?? -1) - (a.conversations ?? -1));

  // Consultas por semana
  const weekly = new Map<string, { queries: number; students: Set<string> }>(
    keys.map((key) => [key, { queries: 0, students: new Set() }]),
  );
  for (const m of messages) {
    const w = weekly.get(weekKey(m.createdAt));
    if (!w) continue;
    w.queries++;
    w.students.add(m.conversation.studentId);
  }
  const queriesByWeek = keys.map((week) => {
    const w = weekly.get(week)!;
    return {
      week,
      queries: visible(w.students.size, k) ? w.queries : null,
    };
  });

  // Feedback
  const fbTotal = { up: 0, down: 0, students: new Set<string>() };
  const fbWeekly = new Map<
    string,
    { up: number; down: number; students: Set<string> }
  >(keys.map((key) => [key, { up: 0, down: 0, students: new Set() }]));
  for (const f of feedback) {
    const sid = f.message.conversation.studentId;
    const isUp = f.value === FeedbackValue.UP;
    fbTotal.students.add(sid);
    if (isUp) fbTotal.up++;
    else fbTotal.down++;
    const w = fbWeekly.get(weekKey(f.createdAt));
    if (w) {
      w.students.add(sid);
      if (isUp) w.up++;
      else w.down++;
    }
  }
  const fbRow = (f: { up: number; down: number; students: Set<string> }) => {
    const show = visible(f.students.size, k);
    const total = f.up + f.down;
    return {
      useful: show ? f.up : null,
      notUseful: show ? f.down : null,
      usefulRate: show ? pct(f.up, total) : null,
      notUsefulRate: show ? pct(f.down, total) : null,
    };
  };

  const notes = [
    'Solo conversaciones no sensibles de alumnos con consentimiento ANALYTICS de la versión vigente.',
    `Etiquetadas: ${labeled.size} de ${eligibleConversations} conversaciones elegibles (etiquetado manual en el piloto).`,
    'Consultas = mensajes enviados por el alumno.',
  ];
  if (!noticeVersion)
    notes.push('No hay aviso ANALYTICS publicado: no hay datos elegibles.');

  return {
    ...ctx.metrics.envelope(
      { weeks: filters.weeks },
      {
        coverage: {
          eligibleConversations,
          labeledConversations: labeled.size,
          labeledRate: pct(labeled.size, eligibleConversations),
        },
        topicsByGroup,
        queriesByWeek,
        feedback: {
          total: fbRow(fbTotal),
          byWeek: keys.map((week) => ({ week, ...fbRow(fbWeekly.get(week)!) })),
        },
      },
      notes,
    ),
    analyticsNoticeVersion: noticeVersion,
  };
}
