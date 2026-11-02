import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { estimateSeconds, formatDuration, type Level, type Passage } from '../../content/passages';
import { ProBadge, Row } from '../ui';
import { fonts, space, useColors } from '../../theme';
import { ShelfRow } from './ShelfRow';

// "Read out loud": Glide passages and the cold read, lower on the Library and collapsed by default
// (topic talk leads; reading is one training method among several). Pro rules as before: today's
// passage is free, the rest come with Pro (requirePro 'library'), and a cold read is Pro ('cold').

const LEVELS: { level: Level; blurb: string }[] = [
  { level: 'Steady', blurb: 'Short sentences, everyday words.' },
  { level: 'Flowing', blurb: 'Mixed rhythm, longer phrases.' },
  { level: 'Sharp', blurb: 'Dense, technical, long clauses.' },
];

export function ReadAloud({
  passages,
  todayId,
  pro,
  onRead,
  onColdRead,
}: {
  passages: readonly Passage[];
  todayId: string;
  pro: boolean;
  /** Opens Glide on a passage (the screen applies the Pro rule for anything but today's). */
  onRead: (p: Passage) => void;
  onColdRead: () => void;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Read out loud. Glide passages and cold reads."
        style={({ pressed }) => [styles.head, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.h2, { color: colors.ink }]}>Read out loud</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>Glide passages and cold reads</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={colors.muted} />
      </Pressable>

      {open && (
        <View style={styles.body}>
          <Text style={[styles.sub, { color: colors.muted }]}>
            {pro ? 'Every passage, any time.' : 'Today’s read is free. The rest of the passages come with Pro.'}
          </Text>
          <ShelfRow
            icon="eye-outline"
            title="Cold read"
            meta="A passage you haven’t seen, read out loud as it appears."
            right={pro ? undefined : <ProBadge />}
            onPress={onColdRead}
          />
          {LEVELS.map(({ level, blurb }) => (
            <View key={level} style={styles.level}>
              <Text style={[styles.levelName, { color: colors.ink }]}>{level}</Text>
              <Text style={[styles.sub, { color: colors.muted }]}>{blurb}</Text>
              {passages
                .filter((p) => p.level === level)
                .map((p) => (
                  <Row
                    key={p.id}
                    title={p.title}
                    meta={`${p.id === todayId ? 'Today · ' : ''}${formatDuration(estimateSeconds(p.text))}`}
                    locked={!pro && p.id !== todayId}
                    onPress={() => onRead(p)}
                  />
                ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space(1) },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(1), minHeight: 44 },
  h2: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 30 },
  sub: { fontSize: 14, lineHeight: 19 },
  body: { gap: space(1.25) },
  level: { gap: space(1) },
  levelName: { fontSize: 17, fontWeight: '700', marginTop: space(1) },
});
