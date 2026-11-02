import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LINE_NAME, type LineId } from '../../content/lines';
import type { WordPack } from '../../content/wordpacks';
import { ProBadge } from '../ui';
import { fonts, space, useColors } from '../../theme';
import { packMeta } from './libraryData';

// One Word Pack on the Library's shelf. A pack a line uses as a lesson wears that line's soft tint
// and says so ("On Sharp Talk"), so the shelf and the home map read as one app. The tint is never
// the only cue: the line's name is written on the card.

export function PackCard({
  pack,
  done,
  ready,
  line,
  pro,
  onPress,
}: {
  pack: WordPack;
  /** Words comfortable so far (libraryData packDone). */
  done: number;
  /** The word book has loaded (until then, no progress is claimed). */
  ready: boolean;
  line: LineId | undefined;
  pro: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const total = pack.words.length;
  const locked = !pack.free && !pro;
  const bg = line ? colors[line === 'sharp' ? 'sharpSoft' : 'clearSoft'] : colors.surface;
  const fill = line ? colors[line] : colors.good;
  const shown = ready ? done : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${pack.title}. ${ready ? packMeta(done, total) : `${total} words`}.${line ? ` On ${LINE_NAME[line]}.` : ''}${pack.free ? ' Free.' : locked ? ' Practice needs Pro.' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: bg, borderColor: line ? bg : colors.line, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.top}>
        <Text style={[styles.count, { color: colors.muted }]}>{ready ? packMeta(done, total).toUpperCase() : `${total} WORDS`}</Text>
        {locked ? (
          <ProBadge />
        ) : pack.free ? (
          // On a surface pill so the green stays readable on either tint.
          <View style={[styles.freePill, { backgroundColor: colors.surface }]}>
            <Text style={[styles.free, { color: colors.good }]}>FREE</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.title, { color: colors.ink }]} numberOfLines={2}>
        {pack.title}
      </Text>
      <Text style={[styles.words, { color: colors.muted }]} numberOfLines={2}>
        {pack.words
          .slice(0, 3)
          .map((w) => w.word)
          .join(' · ')}
        …
      </Text>
      <View style={styles.bottom}>
        <View style={[styles.bar, { backgroundColor: line ? colors.surface : colors.line }]}>
          <View style={[styles.barFill, { backgroundColor: fill, width: `${(shown / Math.max(1, total)) * 100}%` }]} />
        </View>
        {line && (
          <View style={styles.lineRow}>
            <View style={[styles.dot, { backgroundColor: colors[line] }]} />
            <Text style={[styles.lineText, { color: colors.ink }]} numberOfLines={1}>
              On {LINE_NAME[line]}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 212, minHeight: 186, borderRadius: 20, borderWidth: 1, padding: space(2), gap: 6 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6, minHeight: 20 },
  count: { fontSize: 11, fontWeight: '800', letterSpacing: 1, flexShrink: 1 },
  freePill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  free: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  title: { fontFamily: fonts.readingBold, fontSize: 20, lineHeight: 26 },
  words: { fontSize: 13, lineHeight: 18 },
  bottom: { marginTop: 'auto', gap: 8, paddingTop: 4 },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  lineText: { fontSize: 13, fontWeight: '700' },
});
