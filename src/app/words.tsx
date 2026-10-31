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
import { WordReflection } from '../components/WordReflection';
import { fonts, space, useColors } from '../theme';

export default function YourWords() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [book, setBook] = useState<WordBook>({});
  const [ready, setReady] = useState(false);
  const [reflecting, setReflecting] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      loadBook().then((loaded) => {
        if (live) { setBook(loaded); setReady(true); }
      });
      return () => { live = false; Speech.stop(); };
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
            <Text style={[styles.meaning, { color: colors.muted }]}>
              <Text style={{ color: colors.signal, fontWeight: '600' }}>{info.syllables}</Text> · {info.meaning}
            </Text>
          ) : (
            <Text style={[styles.meaning, { color: colors.muted }]}>From your reading</Text>
          )}
          <View style={styles.stageRow}>
            <Mastery days={e.cleanDays.length} colors={colors} />
            <Text style={[styles.stage, { color: colors.muted }]}>{stageLabel(e)}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Practise ${e.word}`} onPress={() => {
              Speech.stop();
              router.push({ pathname: '/fixit', params: { words: e.word, title: 'Your words' } });
            }} style={styles.action}>
              <Text style={[styles.actionText, { color: colors.signal }]}>Practise this word</Text>
            </Pressable>
            {info?.practice && <Pressable accessibilityRole="button" accessibilityLabel={`${reflecting === e.word ? 'Close' : 'Open'} reflection for ${e.word}`} accessibilityState={{ expanded: reflecting === e.word }} onPress={() => {
              Speech.stop();
              setReflecting(reflecting === e.word ? null : e.word);
            }} style={styles.action}>
              <Text style={[styles.actionText, { color: colors.signal }]}>{reflecting === e.word ? 'Close reflection' : 'Use it yourself'}</Text>
            </Pressable>}
          </View>
          {info?.practice && reflecting === e.word && <WordReflection key={e.word} word={info} />}
        </View>
        <Pressable
          onPress={() => { Speech.stop(); Speech.speak(e.word, { language: 'en-US', rate: 0.85 }); }}
          hitSlop={8}
          accessibilityRole="button"
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
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/library')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: insets.bottom + space(4) }]}>
        <Text style={[styles.h1, { color: colors.ink }]}>Your words</Text>
        <Text style={[styles.lead, { color: colors.muted }]}>
          Return to a word, practise it, then try using it in a thought of your own. Comfortable means heard in context on three different days—not a test of spontaneous use.
        </Text>

        {ready && learning.length + learned.length > 0 && <View style={styles.stats}>
          <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[styles.statNum, { color: colors.ink }]}>{learning.length}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Learning</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[styles.statNum, { color: colors.good }]}>{learned.length}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Comfortable</Text>
          </View>
        </View>}

        {due.length > 0 && (
          <PrimaryButton
            label={`Practise today’s ${due.length} ${due.length === 1 ? 'word' : 'words'}`}
            onPress={() => router.push({ pathname: '/fixit', params: { words: due.join(','), title: 'Your words' } })}
          />
        )}

        {!ready && <Text style={[styles.empty, { color: colors.muted }]}>Loading your words…</Text>}
        {ready && learning.length + learned.length === 0 && <View style={styles.emptyState}>
          <Text style={[styles.section, { color: colors.ink }]}>Start with words you want to use</Text>
          <Text style={[styles.meaning, { color: colors.muted }]}>Practise a word pack to begin your collection. Words to revisit from your reading appear here too.</Text>
          <PrimaryButton label="Explore word packs" onPress={() => router.replace('/(tabs)/library')} />
        </View>}
        {ready && due.length === 0 && learning.length + learned.length > 0 && <Text style={[styles.meaning, { color: colors.muted }]}>
          No words are due today. Revisit any word below whenever you like.
        </Text>}

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
  back: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  emptyState: { gap: space(1.5), paddingVertical: space(2) },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space(2) },
  action: { minHeight: 44, justifyContent: 'center' },
  actionText: { fontSize: 14, fontWeight: '600' },
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
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space(1.5), borderWidth: 1, borderRadius: 16, padding: space(2) },
  word: { fontFamily: fonts.readingBold, fontSize: 20, textTransform: 'capitalize' },
  meaning: { fontSize: 14, lineHeight: 20 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  stage: { fontSize: 12, fontWeight: '600' },
  hear: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
