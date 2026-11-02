import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Prompt, PromptLevel } from '../../content/prompts';
import type { LineId } from '../../content/lines';
import { Drop } from '../Drop';
import { fonts, space, useColors } from '../../theme';
import { TOPIC_LEVELS, topicLabel, topicMeta, topicsAt, triedText, type TopicRecord } from './libraryData';

// The Library's first section: all 36 topics, one level at a time, each a free one-minute talk.
// Everyday and Ideas are one or two words, so they sit two to a row; Bigger topics are whole
// questions, so each gets the full width and wraps.

export function TopicTalks({
  level,
  onLevel,
  records,
  line,
  onOpen,
}: {
  level: PromptLevel;
  onLevel: (l: PromptLevel) => void;
  records: ReadonlyMap<string, TopicRecord>;
  /** Your line: its colour marks the topics you've talked on. */
  line: LineId;
  onOpen: (p: Prompt) => void;
}) {
  const colors = useColors();
  const info = TOPIC_LEVELS.find((l) => l.level === level) ?? TOPIC_LEVELS[0];
  const topics = topicsAt(level);
  const wide = level === 3;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.h2, { color: colors.ink }]} accessibilityRole="header">
        Topic talks
      </Text>
      <Text style={[styles.lead, { color: colors.muted }]}>Pick any topic and talk for one minute. Free, as often as you like.</Text>

      {records.size === 0 && (
        // Empty state: nothing talked on yet, so say what will appear here.
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Drop height={46} pose="up" />
          <Text style={[styles.emptyText, { color: colors.ink }]}>Your best Flow on each topic shows up here. Try one and beat it another day.</Text>
        </View>
      )}

      <View style={[styles.switcher, { backgroundColor: colors.line }]} accessibilityRole="tablist">
        {TOPIC_LEVELS.map((l, i) => {
          const on = l.level === level;
          return (
            <Pressable
              key={l.level}
              onPress={() => onLevel(l.level)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${l.name}, ${i + 1} of ${TOPIC_LEVELS.length}`}
              style={[styles.segment, on && { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.segmentText, { color: on ? colors.ink : colors.muted }]} numberOfLines={1}>
                {l.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.levelHead}>
        <Text style={[styles.blurb, { color: colors.muted }]}>{info.blurb}</Text>
        <Text style={[styles.tried, { color: colors.muted }]}>{triedText(level, records)}</Text>
      </View>

      <View style={[styles.grid, wide && styles.list]}>
        {topics.map((p) => {
          const r = records.get(p.id);
          return (
            <Pressable
              key={p.id}
              onPress={() => onOpen(p)}
              accessibilityRole="button"
              accessibilityLabel={topicLabel(p, r)}
              style={({ pressed }) => [
                wide ? styles.row : styles.tile,
                { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[wide ? styles.question : styles.topic, { color: colors.ink }]} numberOfLines={wide ? 3 : 2}>
                {p.text}
              </Text>
              <View style={styles.meta}>
                {r && <Ionicons name="checkmark-circle" size={16} color={colors[line]} />}
                <Text style={[styles.metaText, r ? { color: colors.ink, fontWeight: '700' } : { color: colors.muted }]}>{topicMeta(r)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space(1.25) },
  h2: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 30 },
  lead: { fontSize: 15, lineHeight: 21, marginTop: -space(0.75) },
  empty: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), borderWidth: 1, borderRadius: 20, padding: space(1.5), paddingLeft: space(2) },
  emptyText: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  switcher: { flexDirection: 'row', borderRadius: 16, padding: 4, marginTop: space(0.5) },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 12, paddingHorizontal: 4 },
  segmentText: { fontSize: 15, fontWeight: '700' },
  levelHead: { flexDirection: 'row', alignItems: 'baseline', gap: space(1) },
  blurb: { flex: 1, fontSize: 14, lineHeight: 19 },
  tried: { fontSize: 13, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1) },
  list: { flexDirection: 'column', flexWrap: 'nowrap' },
  // Two per row: (100% − one gap) / 2, without measuring the screen.
  tile: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 16, padding: space(1.75), minHeight: 84, justifyContent: 'space-between', gap: 6 },
  row: { borderWidth: 1, borderRadius: 16, padding: space(1.75), gap: 6, minHeight: 64 },
  topic: { fontFamily: fonts.readingBold, fontSize: 19, lineHeight: 25 },
  question: { fontFamily: fonts.readingBold, fontSize: 17, lineHeight: 24 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 14 },
});
