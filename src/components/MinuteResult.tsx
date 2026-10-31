import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PACE_BANDS, paceZone } from '../engine/score';
import { LONG_PAUSE_MS } from '../engine/minute';
import type { HabitWord } from '../engine/habits';
import type { SavedSession } from '../store/sessions';
import { fillerChips, firstWordSeconds, firstWordText, savedMinuteLine } from '../store/minute';
import { Colors, fonts, space } from '../theme';

/** Always under the number (brief, Decision 3). Flow is about keeping going, never about how you sound. */
export const FLOW_FINE_PRINT = 'Flow is whether you kept talking. It isn’t a grade of your accent or your English.';

/**
 * The Tape for a One Minute session: Flow, the fixed line, the trend against your own minutes,
 * when you started (time to first word),
 * long pauses, pace, um/uh (shown, not scored), likely fillers as chips you can overrule, and one
 * coaching line. Everything comes from the saved numbers; the transcript is never stored.
 */
export function MinuteResult({
  s,
  shown,
  trend,
  onMeant,
  colors,
}: {
  s: SavedSession;
  /** Flow as it counts up. */
  shown: number;
  /** The trend line (store/minute.ts trendText). */
  trend: string;
  /** "I meant that" on a likely filler chip: the earliest standing occurrence of that word. */
  onMeant: (index: number, word: HabitWord) => void;
  colors: Colors;
}) {
  const m = s.minute!;
  const [lo, hi] = PACE_BANDS.talking;
  const zone = paceZone(m.wpm, 'talking');
  const chips = fillerChips(s);
  const meant = s.overruled?.length ?? 0;
  const threshold = LONG_PAUSE_MS / 1000;
  // "You started after 6 seconds." Absent on minutes saved before it was kept.
  const started = firstWordText(firstWordSeconds(s));

  const tiles = [
    {
      label: 'Long pauses',
      value: `${m.longPauses}`,
      unit: '',
      note: m.longPauses ? `longest ${m.longestPauseSeconds} s` : `none over ${threshold} s`,
      tone: colors.muted,
    },
    {
      label: 'Pace',
      value: `${m.wpm}`,
      unit: 'wpm',
      note: zone === 'good' ? `in the ${lo}–${hi} range` : zone === 'fast' ? `above ${hi}` : `below ${lo}`,
      tone: zone === 'good' ? colors.good : colors.ember,
    },
    { label: 'Kept going', value: `${Math.round(m.talkSeconds)}`, unit: 's', note: 'of 60', tone: colors.muted },
    // Shown, not scored: on-device recognisers drop many um/uh, so the number runs low.
    { label: 'um/uh the phone heard', value: `${m.umCount}`, unit: '', note: 'Phones miss some.', tone: colors.muted },
  ];

  return (
    <>
      <View style={styles.scoreRow} accessible accessibilityLabel={`Flow ${s.flow} out of 100`}>
        <Text style={[styles.score, { color: colors.ink }]}>{shown}</Text>
        <Text style={[styles.outOf, { color: colors.muted }]}>/100 Flow</Text>
      </View>
      <Text style={[styles.fine, { color: colors.ink }]}>{FLOW_FINE_PRINT}</Text>
      <Text style={[styles.trend, { color: colors.muted }]}>{trend}</Text>
      {started && <Text style={[styles.started, { color: colors.ink }]}>{started}</Text>}

      <View style={styles.grid}>
        {tiles.map((t) => (
          <View key={t.label} style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[styles.tileLabel, { color: colors.muted }]}>{t.label}</Text>
            <Text style={[styles.tileValue, { color: colors.ink }]}>
              {t.value}
              {t.unit ? <Text style={[styles.tileUnit, { color: colors.muted }]}> {t.unit}</Text> : null}
            </Text>
            <Text style={[styles.tileNote, { color: t.tone }]}>{t.note}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.fine, { color: colors.muted }]}>
        Suggested pace for talking: {lo}–{hi} wpm. It’s a guide, not a rule.
      </Text>

      {/* Likely fillers: shown, not scored (FLOW_SCORED). A tap is "I meant that". */}
      {m.habitFillers.length > 0 && (
        <View style={styles.fillers}>
          {chips.length > 0 ? (
            <>
              <Text style={[styles.fillerText, { color: colors.ink }]}>
                Likely fillers: {chips.map((c) => `${c.word} ×${c.count}`).join(', ')}. Tap any you meant.
              </Text>
              <View style={styles.chips}>
                {chips.map((c) => (
                  <Pressable
                    key={c.word}
                    onPress={() => onMeant(c.next, c.word)}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.word}, ${c.count} ${c.count === 1 ? 'time' : 'times'}. I meant that.`}
                    style={({ pressed }) => [styles.chip, { borderColor: colors.line, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Text style={[styles.chipText, { color: colors.ink }]}>
                      {c.word} <Text style={{ color: colors.muted, fontWeight: '700' }}>×{c.count}</Text>
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <Text style={[styles.fillerText, { color: colors.ink }]}>You meant every word we flagged.</Text>
          )}
          {meant > 0 && chips.length > 0 && (
            <Text style={[styles.fine, { color: colors.muted }]}>You marked {meant} as meant.</Text>
          )}
        </View>
      )}
      {m.habitUnsure > 0 && (
        <Text style={[styles.fine, { color: colors.muted }]}>
          {m.habitUnsure === 1
            ? 'One more habit word was hard to judge, so it isn’t counted.'
            : `${m.habitUnsure} more habit words were hard to judge, so they aren’t counted.`}
        </Text>
      )}

      <Text style={[styles.coach, { color: colors.ink }]}>{savedMinuteLine(s)}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: space(1) },
  score: { fontFamily: fonts.display, fontSize: 88, lineHeight: 92 },
  outOf: { fontSize: 20, fontWeight: '600', marginBottom: 14 },
  fine: { fontSize: 13, lineHeight: 18 },
  trend: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  started: { fontSize: 17, lineHeight: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) },
  tile: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: space(1.75), gap: 2 },
  tileLabel: { fontSize: 13, fontWeight: '500' },
  tileValue: { fontSize: 26, fontWeight: '600', fontVariant: ['tabular-nums'] },
  tileUnit: { fontSize: 13, fontWeight: '400' },
  tileNote: { fontSize: 13 },
  fillers: { gap: space(1) },
  fillerText: { fontSize: 15, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1) },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, minHeight: 40, justifyContent: 'center' },
  chipText: { fontSize: 15 },
  coach: { fontSize: 17, lineHeight: 24 },
});
