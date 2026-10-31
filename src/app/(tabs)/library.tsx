import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { estimateSeconds, formatDuration as duration, Level, PASSAGES, passageOfTheDay } from '../../content/passages';
import { WORD_PACKS } from '../../content/wordpacks';
import { isLearned, summarise, WordBook } from '../../engine/vocab';
import { loadBook } from '../../store/words';
import { useProfile } from '../../store/profile';
import { requirePro } from '../../pro';
import { ProBadge, Row, SectionTitle } from '../../components/ui';
import { fonts, space, useColors } from '../../theme';

const LEVELS: { level: Level; blurb: string }[] = [
  { level: 'Steady', blurb: 'Short sentences, everyday words.' },
  { level: 'Flowing', blurb: 'Mixed rhythm, longer phrases.' },
  { level: 'Sharp', blurb: 'Dense, technical, long clauses.' },
];

export default function Library() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const today = passageOfTheDay();
  const [book, setBook] = useState<WordBook>({});

  useFocusEffect(
    useCallback(() => {
      loadBook().then(setBook);
    }, []),
  );

  const { learning, learned } = summarise(book);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.wrap, { paddingTop: insets.top + space(2), paddingBottom: space(4) }]}
    >
      <Text style={[styles.h1, { color: colors.ink }]}>Library</Text>

      {/* Word Packs */}
      <SectionTitle>Word Packs</SectionTitle>
      <Text style={[styles.blurb, { color: colors.muted }]}>
        Find the precise word. Learn what it means, then put it into a thought of your own.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.packs}>
        {WORD_PACKS.map((p) => {
          const done = p.words.filter((w) => {
            const e = book[w.word.toLowerCase()];
            return e && isLearned(e);
          }).length;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`${p.title}, ${p.words.length} words, ${done} comfortable${!p.free && !profile.pro ? ', practice requires Pro' : ''}`}
              onPress={() => router.push({ pathname: '/pack/[id]', params: { id: p.id } })}
              style={({ pressed }) => [styles.pack, { backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 }]}
            >
              <View style={styles.packTop}>
                <Text style={[styles.packCount, { color: colors.cardMuted }]}>{p.words.length} WORDS</Text>
                {!p.free && !profile.pro ? <ProBadge /> : p.free ? <Text style={[styles.free, { color: colors.good }]}>FREE</Text> : null}
              </View>
              <Text style={[styles.packTitle, { color: colors.cardInk }]}>{p.title}</Text>
              <Text style={[styles.packWords, { color: colors.cardMuted }]} numberOfLines={2}>
                {p.words.slice(0, 3).map((w) => w.word).join(' · ')}…
              </Text>
              <View style={[styles.packBar, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <View style={[styles.packFill, { backgroundColor: colors.good, width: `${(done / p.words.length) * 100}%` }]} />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/words')}
        style={({ pressed }) => [styles.wordsRow, { backgroundColor: colors.signalSoft, opacity: pressed ? 0.8 : 1 }]}
      >
        <Ionicons name="bookmark" size={20} color={colors.signal} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.wordsTitle, { color: colors.ink }]}>Your words</Text>
          <Text style={[styles.wordsMeta, { color: colors.muted }]}>
            {learning.length + learned.length === 0 ? 'Words you practise or trip on collect here' : `${learning.length} learning · ${learned.length} comfortable`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>

      {/* Passages */}
      <Text style={[styles.sub, { color: colors.muted, marginTop: space(1) }]}>
        {profile.pro ? 'Every passage, any time.' : 'Today’s read is free. The rest of the passages come with Pro.'}
      </Text>
      {LEVELS.map(({ level, blurb }) => (
        <View key={level} style={{ gap: space(1.25) }}>
          <SectionTitle>{level}</SectionTitle>
          <Text style={[styles.blurb, { color: colors.muted }]}>{blurb}</Text>
          {PASSAGES.filter((p) => p.level === level).map((p) => {
            const locked = !profile.pro && p.id !== today.id;
            return (
              <Row
                key={p.id}
                title={p.title}
                meta={`${p.id === today.id ? 'Today · ' : ''}${duration(estimateSeconds(p.text))}`}
                locked={locked}
                onPress={() =>
                  (p.id === today.id || requirePro(profile, 'library')) &&
                  router.push({ pathname: '/session/[id]', params: { id: p.id } })
                }
              />
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space(2.5), gap: space(1.5) },
  h1: { fontFamily: fonts.displayBold, fontSize: 32 },
  sub: { fontSize: 15, lineHeight: 21 },
  blurb: { fontSize: 14, marginTop: -space(1) },
  packs: { gap: space(1.25), paddingRight: space(2.5) },
  pack: { width: 220, borderRadius: 20, padding: space(2), gap: 6 },
  packTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  packCount: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  free: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  packTitle: { fontFamily: fonts.readingBold, fontSize: 21 },
  packWords: { fontSize: 13, lineHeight: 18 },
  packBar: { height: 4, borderRadius: 2, marginTop: 6 },
  packFill: { height: 4, borderRadius: 2 },
  wordsRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), borderRadius: 16, padding: space(2) },
  wordsTitle: { fontSize: 17, fontWeight: '700' },
  wordsMeta: { fontSize: 14, marginTop: 2 },
});
