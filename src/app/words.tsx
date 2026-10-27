import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DICTIONARY } from '../content/wordpacks';
import { dueWords, stageLabel, summarise, WordBook, WordEntry } from '../engine/vocab';
import { loadBook } from '../store/words';
import { Mastery } from '../components/Mastery';
import { PrimaryButton } from '../components/ui';
import { fonts, space, useColors } from '../theme';

export default function YourWords() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [book, setBook] = useState<WordBook>({});

  useFocusEffect(
    useCallback(() => {
      loadBook().then(setBook);
    }, []),
  );

  const { learning, learned } = summarise(book);
  const due = dueWords(book);

  const row = (e: WordEntry) => {
    const info = DICTIONARY.get(e.word);
    return (
      <View key={e.word} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={[styles.word, { color: colors.ink }]}>{e.word}</Text>
          {info ? (
            <Text style={[styles.meaning, { color: colors.muted }]} numberOfLines={2}>
              <Text style={{ color: colors.signal, fontWeight: '600' }}>{info.syllables}</Text> · {info.meaning}
            </Text>
          ) : (
            <Text style={[styles.meaning, { color: colors.muted }]}>From your reading · tripped {e.stumbles}×</Text>
          )}
          <View style={styles.stageRow}>
            <Mastery days={e.cleanDays.length} colors={colors} />
            <Text style={[styles.stage, { color: colors.muted }]}>{stageLabel(e)}</Text>
          </View>
        </View>
        <Pressable
          onPress={() => Speech.speak(e.word, { language: 'en-US', rate: 0.85 })}
          hitSlop={8}
          accessibilityLabel={`Hear how to say ${e.word}`}
          style={[styles.hear, { backgroundColor: colors.signalSoft }]}
        >
          <Ionicons name="volume-medium" size={20} color={colors.signal} />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: insets.bottom + space(4) }]}>
        <Text style={[styles.h1, { color: colors.ink }]}>Your words</Text>
        <Text style={[styles.lead, { color: colors.muted }]}>
          Every word you’ve practised or tripped on. Say one cleanly in a sentence on three different days and it becomes comfortable.
        </Text>

        <View style={styles.stats}>
          <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[styles.statNum, { color: colors.ink }]}>{learning.length}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Learning</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[styles.statNum, { color: colors.good }]}>{learned.length}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Comfortable</Text>
          </View>
        </View>

        {due.length > 0 && (
          <PrimaryButton
            label={`Practise today’s ${due.length} ${due.length === 1 ? 'word' : 'words'}`}
            onPress={() => router.push({ pathname: '/fixit', params: { words: due.join(','), title: 'Your words' } })}
          />
        )}

        {learning.length + learned.length === 0 && (
          <Text style={[styles.empty, { color: colors.muted }]}>
            Nothing yet. Open a Word Pack, or just read: any long word you trip on lands here.
          </Text>
        )}

        {learning.length > 0 && <Text style={[styles.section, { color: colors.ink }]}>Learning</Text>}
        {learning.map(row)}
        {learned.length > 0 && <Text style={[styles.section, { color: colors.ink }]}>Comfortable</Text>}
        {learned.map(row)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { paddingHorizontal: space(2), height: 48, justifyContent: 'center' },
  wrap: { paddingHorizontal: space(2.5), gap: space(1.5) },
  h1: { fontFamily: fonts.displayBold, fontSize: 32 },
  lead: { fontSize: 16, lineHeight: 23 },
  stats: { flexDirection: 'row', gap: space(1.25) },
  stat: { flex: 1, borderWidth: 1, borderRadius: 16, padding: space(1.75) },
  statNum: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 13, fontWeight: '500' },
  empty: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: space(2) },
  section: { fontSize: 17, fontWeight: '700', marginTop: space(1) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), borderWidth: 1, borderRadius: 16, padding: space(2) },
  word: { fontFamily: fonts.readingBold, fontSize: 20, textTransform: 'capitalize' },
  meaning: { fontSize: 14, lineHeight: 20 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  stage: { fontSize: 12, fontWeight: '600' },
  hear: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
