import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PaceSegment, Steadiness } from '../engine/steadiness';
import { UNSTEADY_BELOW } from '../engine/steadiness';
import { Colors, space } from '../theme';

const H = 72;

/**
 * Pace of each stretch of the passage as thin bars, with the suggested range shaded.
 * Colour is never the only cue: the caption names the numbers, and tapping a bar shows
 * which words it covers.
 */
export function PaceStrip({
  segments,
  steady,
  band,
  snippet,
  colors,
}: {
  segments: PaceSegment[];
  steady: Steadiness;
  band: [number, number];
  /** The first few words of a stretch, so the reader can find it in the passage. */
  snippet: (s: PaceSegment) => string;
  colors: Colors;
}) {
  const unsteady = steady.score < UNSTEADY_BELOW;
  // Start on the fastest stretch when the pace drifted: that's usually the rush to fix.
  const [picked, setPicked] = useState<number | null>(unsteady ? steady.fastest : null);
  const lo = Math.min(band[0], steady.low) - 20;
  const hi = Math.max(band[1], steady.high) + 10;
  const y = (wpm: number) => ((wpm - lo) / (hi - lo)) * H;
  const where = (wpm: number) => (wpm > band[1] ? 'above the range' : wpm < band[0] ? 'below the range' : 'in range');

  const p = picked !== null ? segments[picked] : undefined;
  const caption = p
    ? `${p.wpm} wpm at “${snippet(p)}…”, ${where(p.wpm)}.`
    : unsteady
      ? `From ${steady.low} to ${steady.high} wpm. Tap a bar to see where.`
      : `Steady: every stretch between ${steady.low} and ${steady.high} wpm.`;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.ink }]}>Pace by sentence</Text>
        <Text style={[styles.score, { color: colors.ink }]}>
          {steady.score}
          <Text style={[styles.scoreUnit, { color: colors.muted }]}> steadiness</Text>
        </Text>
      </View>

      <View style={[styles.plot, { height: H }]}>
        {/* The suggested range, so a bar's position reads at a glance */}
        <View
          style={[styles.band, { backgroundColor: colors.good, bottom: y(band[0]), height: y(band[1]) - y(band[0]) }]}
          pointerEvents="none"
        />
        {segments.map((s, i) => {
          const inRange = s.wpm >= band[0] && s.wpm <= band[1];
          const on = picked === i;
          return (
            <Pressable
              key={s.start}
              onPress={() => setPicked(on ? null : i)}
              style={styles.col}
              accessibilityRole="button"
              accessibilityLabel={`Stretch ${i + 1} of ${segments.length}: ${s.wpm} words per minute, ${where(s.wpm)}`}
              accessibilityState={{ selected: on }}
            >
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(4, y(s.wpm)),
                    backgroundColor: inRange ? colors.good : colors.ember,
                    opacity: picked === null || on ? 1 : 0.45,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.baseline, { backgroundColor: colors.line }]} />

      <Text style={[styles.caption, { color: colors.muted }]}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: space(1.75), gap: space(1) },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontSize: 15, fontWeight: '600' },
  score: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  scoreUnit: { fontSize: 13, fontWeight: '400' },
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  band: { position: 'absolute', left: 0, right: 0, opacity: 0.14, borderRadius: 2 },
  // The whole column is the tap target, taller and wider than the bar itself.
  col: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '70%', maxWidth: 24, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  baseline: { height: 1 },
  caption: { fontSize: 13, lineHeight: 18 },
});
