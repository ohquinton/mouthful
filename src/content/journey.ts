import { calendarDay } from '../engine/days';
import type { SavedSession } from '../store/sessions';

export type PracticeLine = 'sharp' | 'clear';
export const LINE_NAMES: Record<PracticeLine, string> = { sharp: 'Sharp Talk', clear: 'Clear English' };

/** Dates belong to the reader's calendar, including the two clock-change days. */
export function dailyStopId(line: PracticeLine, date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${line}:${date.getFullYear()}-${month}-${day}`;
}

export function dailyJourney(sessions: SavedSession[], line: PracticeLine, date: Date) {
  const id = dailyStopId(line, date);
  const talks = sessions.filter((s) => s.kind === 'minute' && Number.isFinite(s.flow) && s.stopId?.startsWith(`${line}:`));
  const today = talks.filter((s) => s.stopId === id).sort((a, b) => b.at - a.at)[0];
  const previous = talks.filter((s) => calendarDay(s.at) < calendarDay(date)).sort((a, b) => b.at - a.at)[0];
  // Repeating a talk doesn't invent another station or advance tomorrow's practice.
  const completed = new Set(talks.filter((s) => calendarDay(s.at) <= calendarDay(date)).map((s) => s.stopId)).size;
  return { id, today, previous, completed };
}
