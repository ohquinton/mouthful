import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PASSAGES, passageOfTheDay } from '../../content/passages';
import { WORD_PACKS } from '../../content/wordpacks';
import { loadScripts } from '../../content/scripts';
import { EXPERIENCES } from '../../content/experiences';
import type { PromptLevel } from '../../content/prompts';
import { summarise, type WordBook } from '../../engine/vocab';
import { loadBook } from '../../store/words';
import { loadSessions, type SavedSession } from '../../store/sessions';
import { useProfile } from '../../store/profile';
import { useExperience } from '../../store/experience';
import { requirePro } from '../../pro';
import { TopicTalks } from '../../components/library/TopicTalks';
import { PackCard } from '../../components/library/PackCard';
import { ShelfRow } from '../../components/library/ShelfRow';
import { ReadAloud } from '../../components/library/ReadAloud';
import { coldReadPick, packDone, scriptsMeta, topicRecords, topicRoute, wordsMeta } from '../../components/library/libraryData';
import { fonts, space, useColors } from '../../theme';

export default function Library() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const { profile } = useProfile();
  const { mode } = useExperience();
  const experience = EXPERIENCES[mode ?? 'articulation'];
  const english = mode === 'english';
  const line = experience.line;
  // Keep the topic tab within this experience even when the available levels change.
  const [chosenLevel, setLevel] = useState<PromptLevel>();
  const levels: readonly PromptLevel[] = experience.levels;
  const level = chosenLevel && levels.includes(chosenLevel) ? chosenLevel : levels[0];
  const [book, setBook] = useState<WordBook>({});
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [scriptCount, setScriptCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [date, setDate] = useState(() => new Date());
  useFocusEffect(useCallback(() => {
    let live = true;
    setReady(false);
    setDate(new Date());
    // All three store readers handle unavailable storage without rejecting.
    Promise.all([loadSessions(), loadBook(), loadScripts()]).then(([all, words, scripts]) => {
      if (!live) return;
      setSessions(all); setBook(words); setScriptCount(scripts.length); setReady(true);
    });
    return () => { live = false; };
  }, []));
  const today = passageOfTheDay(date);
  const records = useMemo(() => topicRecords(sessions), [sessions]);
  const { learning, learned } = summarise(book);
  const largeText = fontScale > 1.3;
  const packWidth = largeText ? Math.min(width - space(5), 520) : Math.min(240, width - space(5));
  const packIds: readonly string[] = experience.packs;
  const packs = WORD_PACKS.filter((p) => packIds.includes(p.id));
  const reading = (
    <ReadAloud key={mode} passages={PASSAGES} todayId={today.id} pro={profile.pro} ready={ready} initiallyOpen={english}
      onRead={(p) => { if (p.id === today.id || requirePro(profile, 'library')) router.push({ pathname: '/session/[id]', params: { id: p.id } }); }}
      onColdRead={() => { const p = coldReadPick(PASSAGES, sessions); if (p && requirePro(profile, 'cold')) router.push({ pathname: '/session/[id]', params: { id: p.id, cold: '1' } }); }} />
  );
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[styles.wrap, { paddingTop: insets.top + space(2), paddingBottom: space(4) }]}>
      <View style={styles.header}>
        <Text style={[styles.mode, { color: colors[line] }]}>{experience.name}</Text>
        <Text accessibilityRole="header" style={[styles.h1, { color: colors.ink }]}>{english ? 'English practice' : 'Articulation practice'}</Text>
        <Text style={[styles.lead, { color: colors.muted }]}>{english ? 'Read aloud, practise useful words, then speak about everyday things.' : 'Develop an idea, choose precise words and rehearse your delivery.'}</Text>
      </View>
      {english && reading}
      <TopicTalks level={level} levels={levels} onLevel={setLevel} records={records} ready={ready} line={line} onOpen={(p) => router.push(topicRoute(p.id))} />
      <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.h2, { color: colors.ink }]}>Word packs</Text>
        <Text style={[styles.lead, { color: colors.muted }]}>{english ? 'Learn useful English through meanings, examples and sentences.' : 'Find the precise word, then make it your own.'}</Text>
        <ScrollView horizontal={!largeText} showsHorizontalScrollIndicator={!largeText} contentContainerStyle={[styles.packs, largeText && styles.packList]}>
          {packs.map((p) => <PackCard key={p.id} pack={p} done={packDone(p, book)} ready={ready} line={undefined} pro={profile.pro} width={packWidth} onPress={() => router.push({ pathname: '/pack/[id]', params: { id: p.id } })} />)}
        </ScrollView>
      </View>
      <View style={styles.section}>
        <ShelfRow icon="bookmark-outline" title="Your words" meta={wordsMeta(ready, learning.length, learned.length)} onPress={() => router.push('/words')} />
        <ShelfRow icon="document-text-outline" title="Your scripts" meta={scriptsMeta(ready, scriptCount, profile.pro)} onPress={() => router.push('/scripts')} />
        <Text style={[styles.lead, { color: colors.muted }]}>Your saved words and scripts are shared across both experiences.</Text>
      </View>
      {!english && <View style={[styles.reading, { borderTopColor: colors.line }]}>{reading}</View>}
      {!english && <Pressable accessibilityRole="button" onPress={() => router.push('/moment')} style={({ pressed }) => [styles.plan, { opacity: pressed ? 0.7 : 1 }]}>
        <Ionicons name="calendar-outline" size={18} color={colors.muted} />
        <Text style={[styles.planText, { color: colors.muted }]}>Something coming up? <Text style={{ color: colors.ink, fontWeight: '700' }}>Plan for it</Text></Text>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </Pressable>}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space(2.5), gap: space(3), maxWidth: 620, width: '100%', alignSelf: 'center' },
  header: { gap: space(0.75) },
  mode: { fontSize: 15, fontWeight: '700' },
  h1: { fontFamily: fonts.displayBold, fontSize: 34, lineHeight: 42 },
  h2: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 30 },
  lead: { fontSize: 15, lineHeight: 22 },
  section: { gap: space(1.25) },
  packs: { gap: space(1.25), paddingBottom: space(1) },
  packList: { flexDirection: 'column' },
  reading: { borderTopWidth: 1, paddingTop: space(2.5) },
  plan: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space(1), paddingBottom: space(1) },
  planText: { flex: 1, fontSize: 14, lineHeight: 21 },
});
