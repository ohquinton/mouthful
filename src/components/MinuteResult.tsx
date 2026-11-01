import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { PACE_BANDS, paceZone } from '../engine/score';
import { LONG_PAUSE_MS } from '../engine/minute';
import type { HabitWord } from '../engine/habits';
import type { SavedSession } from '../store/sessions';
import { fillerChips, firstWordSeconds, savedMinuteLine, type MinuteRecord } from '../store/minute';
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
  firstWordUsual,
  onMeant,
  colors,
}: {
  s: SavedSession;
  /** Flow as it counts up. */
  shown: number;
  /** The trend line (store/minute.ts trendText). */
  trend: string;
  firstWordUsual?: number;
  /** "I meant that" on a likely filler chip: the earliest standing occurrence of that word. */
  onMeant: (index: number, word: HabitWord) => void;
  colors: Colors;
}) {
  const m = s.minute! as MinuteRecord;
  const reducedMotion = useReducedMotion();
  const { fontScale, width } = useWindowDimensions();
  const singleColumn = fontScale > 1.3 || width < 350;
  const [lo, hi] = PACE_BANDS.talking;
  const zone = paceZone(m.wpm, 'talking');
  const chips = fillerChips(s);
  const meant = s.overruled?.length ?? 0;
  const threshold = LONG_PAUSE_MS / 1000;
  const started = firstWordSeconds(s);
  const repeated = m.repeated?.[0];

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
    ...(m.repeated ? [{
      label: 'Repeated words',
      value: repeated ? repeated.word : '—',
      unit: repeated ? `×${repeated.count}` : '',
      note: repeated ? 'Shown, not scored.' : 'No repeated words flagged.',
      tone: colors.muted,
    }] : []),
    ...(started !== undefined ? [{
      label: 'First word', value: `${started}`, unit: 's',
      note: firstWordUsual !== undefined ? `Your usual: ${Math.round(firstWordUsual * 10) / 10} s` : 'The first 8 seconds are free.',
      tone: colors.muted,
    }] : []),
  ];

  return (
    <>
      <View style={styles.scoreRow} accessible accessibilityLabel={`Flow ${s.flow} out of 100`}>
        <Text style={[styles.score, { color: colors.ink }]}>{shown}</Text>
        <Text style={[styles.outOf, { color: colors.muted }]}>/100 Flow</Text>
      </View>
      <Text style={[styles.fine, { color: colors.muted }]}>{FLOW_FINE_PRINT}</Text>
      <Text style={[styles.trend, { color: colors.muted }]}>{trend}</Text>

      <View style={[styles.coachCard, { backgroundColor: colors.signalSoft }]}>
        <Text style={[styles.coachLabel, { color: colors.signal }]}>ONE THING TO TAKE WITH YOU</Text>
        <Text style={[styles.coach, { color: colors.ink }]}>{savedMinuteLine(s)}</Text>
      </View>
      <Text style={[styles.section, { color: colors.muted }]}>YOUR TALK, IN DETAIL</Text>

      <View style={styles.grid}>
        {tiles.map((t, index) => (
          <Animated.View key={t.label} entering={reducedMotion ? undefined : FadeIn.duration(240).delay(index * 65)} style={[styles.tile, singleColumn && styles.fullTile, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[styles.tileLabel, { color: colors.muted }]}>{t.label}</Text>
            <Text style={[styles.tileValue, { color: colors.ink }]}>
              {t.value}
              {t.unit ? <Text style={[styles.tileUnit, { color: colors.muted }]}> {t.unit}</Text> : null}
            </Text>
            <Text style={[styles.tileNote, { color: t.tone }]}>{t.note}</Text>
          </Animated.View>
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

    </>
  );
}

const styles = StyleSheet.create({
  scoreRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 4, marginTop: space(1) },
  score: { fontFamily: fonts.display, fontSize: 88, lineHeight: 92 },
  outOf: { fontSize: 20, fontWeight: '600', marginBottom: 14 },
  fine: { fontSize: 13, lineHeight: 18 },
  trend: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  coachCard: { borderRadius: 22, padding: space(2.5), gap: space(1) },
  coachLabel: { fontSize: 10, lineHeight: 16, fontWeight: '700', letterSpacing: 1.1 },
  section: { fontSize: 11, lineHeight: 17, fontWeight: '700', letterSpacing: 1, marginTop: space(1) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) },
  tile: { flexBasis: '47%', flexGrow: 1, flexShrink: 1, minWidth: 0, borderWidth: 1, borderRadius: 18, padding: space(1.75), gap: 4 },
  fullTile: { flexBasis: '100%' },
  tileLabel: { fontSize: 13, fontWeight: '500' },
  tileValue: { fontSize: 26, fontWeight: '600', fontVariant: ['tabular-nums'] },
  tileUnit: { fontSize: 13, fontWeight: '400' },
  tileNote: { fontSize: 13 },
  fillers: { gap: space(1) },
  fillerText: { fontSize: 15, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1) },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, minHeight: 44, justifyContent: 'center' },
  chipText: { fontSize: 15 },
  coach: { fontSize: 17, lineHeight: 24 },
});
