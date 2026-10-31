import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getPack, packPassageId } from '../../content/wordpacks';
import { estimateSeconds, formatDuration } from '../../content/passages';
import { isLearned, stageLabel, WordBook } from '../../engine/vocab';
import { loadBook } from '../../store/words';
import { useProfile } from '../../store/profile';
import { requirePro } from '../../pro';
import { WordReflection } from '../../components/WordReflection';
import { Mastery } from '../../components/Mastery';
import { PrimaryButton, ProBadge } from '../../components/ui';
import { fonts, space, useColors } from '../../theme';

export default function PackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pack = getPack(id ?? '');
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const [book, setBook] = useState<WordBook>({});
  // Recalling a word is practice, not evidence of mastery. This never changes the word book.
  const [practisingWord, setPractisingWord] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadBook().then(setBook);
    }, []),
  );

  if (!pack) return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.empty, { paddingTop: insets.top + space(4), paddingBottom: insets.bottom + space(4) }]}
    >
      <Text style={[styles.h1, { color: colors.ink }]}>This pack isn’t available</Text>
      <Text style={[styles.pitch, { color: colors.muted }]}>Explore the Library to find your next words.</Text>
      <PrimaryButton label="Go to Library" onPress={() => router.replace('/(tabs)/library')} />
    </ScrollView>
  );

  const unlocked = pack.free || profile.pro;
  const gate = () => unlocked || requirePro(profile, 'packs');
  const learned = pack.words.filter((w) => {
    const e = book[w.word.toLowerCase()];
    return e && isLearned(e);
  }).length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.top}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/library')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: insets.bottom + space(4) }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>WORD PACK · {pack.words.length} WORDS</Text>
          {!unlocked && <ProBadge />}
        </View>
        <Text style={[styles.h1, { color: colors.ink }]}>{pack.title}</Text>
        <Text style={[styles.pitch, { color: colors.muted }]}>{pack.pitch}</Text>

        <Text style={[styles.sub, { color: colors.muted }]}>
          {learned} of {pack.words.length} comfortable · Built through practice on different days.
        </Text>

        <PrimaryButton
          label={unlocked ? 'Practise these words' : 'Explore Pro to practise'}
          onPress={() =>
            gate() &&
            router.push({ pathname: '/fixit', params: { words: pack.words.map((w) => w.word).join(','), title: pack.title } })
          }
        />
        <Text style={[styles.sub, { color: colors.muted }]}>
          {unlocked ? 'Say each word, then read it in a sentence. Or explore the meanings below at your own pace.' : 'Explore the meanings below. Guided speaking practice is included with Pro.'}
        </Text>

        {pack.words.map((w) => {
          const e = book[w.word.toLowerCase()];
          return (
            <View key={w.word} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.word, { color: colors.ink }]}>{w.word}</Text>
                  <Text style={[styles.syll, { color: colors.muted }]}>{w.syllables}</Text>
                </View>
                <Pressable
                  onPress={() => Speech.speak(w.word, { language: 'en-US', rate: 0.85 })}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Hear how to say ${w.word}`}
                  style={[styles.hear, { backgroundColor: colors.signalSoft }]}
                >
                  <Ionicons name="volume-medium" size={20} color={colors.signal} />
                </Pressable>
              </View>
              <Text style={[styles.meaning, { color: colors.ink }]}>{w.meaning}</Text>
              {w.practice && practisingWord === w.word ? (
                <View style={[styles.practice, { borderColor: colors.line }]}>
                  <WordReflection key={w.word} word={w} />
                </View>
              ) : (
                <Text style={[styles.example, { color: colors.muted }]}>“{w.example}”</Text>
              )}
              {w.practice && (
                <Pressable
                  onPress={() => setPractisingWord(practisingWord === w.word ? null : w.word)}
                  accessibilityRole="button"
                  accessibilityLabel={practisingWord === w.word ? `Close practice for ${w.word}` : `Practise ${w.word} in your own words`}
                  accessibilityState={{ expanded: practisingWord === w.word }}
                  style={({ pressed }) => [styles.practiceButton, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[styles.practiceTitle, { color: colors.signal }]}>
                    {practisingWord === w.word ? 'Close practice' : 'Use it yourself'}
                  </Text>
                </Pressable>
              )}
              <View style={styles.cardBottom}>
                <Mastery days={e?.cleanDays.length ?? 0} colors={colors} />
                <Text style={[styles.status, { color: colors.muted }]}>
                  {stageLabel(e)}{e?.stumbles ? ` · missed ${e.stumbles}×` : ''}
                </Text>
              </View>
            </View>
          );
        })}

        <Text style={[styles.section, { color: colors.ink }]}>Say them in context</Text>
        <Text style={[styles.sub, { color: colors.muted }]}>
          Short passages that put the words into a complete thought.
        </Text>
        {pack.passages.map((p, n) => (
          <Pressable
            key={p.title}
            accessibilityRole="button"
            accessibilityLabel={`${p.title}, ${formatDuration(estimateSeconds(p.text))}${unlocked ? '' : ', requires Pro'}`}
            onPress={() => gate() && router.push({ pathname: '/session/[id]', params: { id: packPassageId(pack.id, n) } })}
            style={({ pressed }) => [styles.passage, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.75 : 1 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.passageTitle, { color: colors.ink }]}>{p.title}</Text>
              <Text style={[styles.sub, { color: colors.muted }]}>{formatDuration(estimateSeconds(p.text))}</Text>
            </View>
            <Ionicons name={unlocked ? 'mic' : 'lock-closed'} size={18} color={unlocked ? colors.signal : colors.muted} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  empty: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: space(2.5), gap: space(2) },
  back: { minWidth: 44, minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  top: { paddingHorizontal: space(2), height: 48, justifyContent: 'center' },
  wrap: { paddingHorizontal: space(2.5), gap: space(1.5) },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
  h1: { fontFamily: fonts.displayBold, fontSize: 32 },
  pitch: { fontSize: 17, lineHeight: 24 },
  card: { borderWidth: 1, borderRadius: 18, padding: space(2), gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space(1) },
  word: { fontFamily: fonts.readingBold, fontSize: 24 },
  syll: { fontSize: 15, fontWeight: '600', letterSpacing: 0.3, marginTop: 2 },
  hear: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  meaning: { fontSize: 16, lineHeight: 22, marginTop: 4 },
  example: { fontFamily: fonts.reading, fontSize: 15, lineHeight: 22 },
  practice: { borderTopWidth: 1, paddingTop: space(1.5), marginTop: space(1), gap: space(1) },
  practiceTitle: { fontSize: 15, fontWeight: '600' },
  practiceButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingRight: space(2) },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  status: { fontSize: 13, fontWeight: '600' },
  section: { fontSize: 17, fontWeight: '700', marginTop: space(2) },
  sub: { fontSize: 14, lineHeight: 20 },
  passage: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: space(2), minHeight: 64 },
  passageTitle: { fontSize: 17, fontWeight: '600' },
});
