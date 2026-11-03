import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '../../store/profile';
import { useExperience } from '../../store/experience';
import { EXPERIENCES, experienceTopic } from '../../content/experiences';
import { loadBook } from '../../store/words';
import { loadSessions, type SavedSession } from '../../store/sessions';
import { summarise, type WordBook } from '../../engine/vocab';
import { ahaPaywallRoute, ahaPending, claimAhaPaywall } from '../../pro';
import { ShelfRow } from '../../components/library/ShelfRow';
import { PrimaryButton } from '../../components/ui';
import { PlanCard } from '../../components/PlanCard';
import { fonts, space, useColors } from '../../theme';

export default function Home() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { mode, showChoices } = useExperience();
  const { profile, ready, update } = useProfile();
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [book, setBook] = useState<WordBook>({});
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useFocusEffect(useCallback(() => {
    let live = true;
    setLoaded(false);
    Promise.all([loadSessions(), loadBook()]).then(([saved, words]) => {
      if (!live) return;
      setSessions(saved);
      setBook(words);
      setNow(new Date());
      setLoaded(true);
    });
    return () => { live = false; };
  }, []));

  // Keep the existing one-time free-rehearsal handoff when its result screen was interrupted.
  const { pro, ahaPaywallShown, moment } = profile;
  useFocusEffect(useCallback(() => {
    if (!ready || pro || ahaPaywallShown) return;
    let live = true;
    loadSessions().then((all) => {
      const run = ahaPending({ profile: { pro, ahaPaywallShown }, sessions: all });
      if (!live || !run || !claimAhaPaywall()) return;
      update({ ahaPaywallShown: true });
      router.push(ahaPaywallRoute(run, moment));
    });
    return () => { live = false; };
  }, [ready, pro, ahaPaywallShown, moment, update]));

  if (!mode) return null;
  const experience = EXPERIENCES[mode];
  const english = mode === 'english';
  const topic = experienceTopic(mode, now);
  const accent = colors[experience.line];
  const { learning, comfortable } = summarise(book);
  const wordCount = learning.length + comfortable.length;
  const startTalk = () => router.push({ pathname: '/talk', params: { prompt: topic.id, seconds: '60', from: 'home' } });
  const openReading = () => router.push({ pathname: '/session/[id]', params: { id: 'w.meetings.0' } });

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[styles.wrap, { paddingTop: insets.top + space(2), paddingBottom: space(4) }]}>
      <View style={styles.header}>
        <Text style={[styles.brand, { color: accent }]}>SaidClearly · {experience.name}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Switch between Articulation and English Speaking" onPress={showChoices} style={({ pressed }) => [styles.switch, { opacity: pressed ? 0.65 : 1 }]}>
          <Text style={[styles.switchText, { color: colors.ink }]}>Switch experience</Text>
        </Pressable>
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>{experience.promise}</Text>
        <Text style={[styles.lead, { color: colors.muted }]}>{english ? 'Start with words in a sentence. Then try speaking in your own words.' : 'Put an idea into words. Review your delivery, then try one useful adjustment.'}</Text>
      </View>
      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: accent }]}>
        <Text style={[styles.eyebrow, { color: accent }]}>{english ? 'GUIDED ENGLISH PRACTICE' : 'TODAY’S TOPIC · 1 MINUTE'}</Text>
        <Text accessibilityRole="header" style={[styles.h2, { color: colors.ink }]}>{english ? 'Opening a meeting' : topic.text}</Text>
        <Text style={[styles.lead, { color: colors.muted }]}>{english ? 'Read useful phrases aloud and follow the words the phone hears. Free guided practice.' : 'Speak without a script. Afterwards, review fillers the phone heard, repeated words and pace.'}</Text>
        <PrimaryButton label={english ? 'Read aloud' : 'Start a topic talk'} onPress={english ? openReading : startTalk} />
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.h2, { color: colors.ink }]}>{english ? 'Build your everyday English' : 'Practise with a purpose'}</Text>
        {english ? (
          <>
            <ShelfRow icon="chatbubble-outline" title="Speak in your own words" meta={`Today’s everyday topic: ${topic.text}. One minute, with optional starter ideas.`} onPress={startTalk} />
            <ShelfRow icon="book-outline" title="Useful words in context" meta="Explore meanings and examples, then practise the words in sentences." onPress={() => router.push({ pathname: '/pack/[id]', params: { id: 'meetings' } })} />
            <ShelfRow icon="library-outline" title="English practice library" meta="Everyday topics, guided passages and word packs." onPress={() => router.push('/library')} />
          </>
        ) : (
          <>
            <ShelfRow icon="chatbubbles-outline" title="Think on your feet" meta="Explain an idea, tell a story or make a case. Choose a topic to practise." onPress={() => router.push('/library')} />
            <ShelfRow icon="book-outline" title="Find a more precise word" meta="Make your point: learn useful vocabulary, then express your own thought." onPress={() => router.push({ pathname: '/pack/[id]', params: { id: 'precision' } })} />
            <ShelfRow icon="document-text-outline" title="Rehearse your real words" meta="Practise a script and review your pace and delivery. Your first script is free." onPress={() => router.push('/scripts')} />
          </>
        )}
        <ShelfRow icon="bookmark-outline" title={english ? 'Practise your saved words' : 'Keep your vocabulary active'}
          meta={!loaded ? 'Loading your words…' : wordCount ? `${wordCount} saved ${wordCount === 1 ? 'word' : 'words'} across both experiences. Revisit one or practise words due today.` : 'Words you practise collect here. Start with a word pack.'}
          onPress={() => router.push('/words')} />
        {english && <ShelfRow icon="document-text-outline" title="Practise something you will say" meta="Add your own English sentences or a short script. Your first script is free." onPress={() => router.push('/scripts')} />}
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.h2, { color: colors.ink }]}>See what changes</Text>
        <ShelfRow icon="stats-chart-outline" title="Your practice history" meta="Review results and compare compatible attempts. History is shared across both experiences." onPress={() => router.push('/progress')} />
        <Text style={[styles.note, { color: colors.muted }]}>{english ? 'The phone shows what it heard. It does not grade your accent or pronunciation, and you can correct missed words.' : 'Filler counts depend on what the phone transcribes. Flow describes continuity and pace, not the quality of your ideas.'}</Text>
      </View>
      {!english && (moment ? <PlanCard sessions={sessions} /> : <ShelfRow icon="calendar-outline" title="Prepare for something coming up" meta="A meeting, interview or presentation: practise the words you will need." onPress={() => router.push('/moment')} />)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space(2.5), gap: space(3), width: '100%', maxWidth: 620, alignSelf: 'center' },
  header: { gap: space(0.5), alignItems: 'flex-start' },
  brand: { fontSize: 15, fontWeight: '700', lineHeight: 22 },
  switch: { minHeight: 44, justifyContent: 'center' },
  switchText: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  title: { fontFamily: fonts.displayBold, fontSize: 32, lineHeight: 39 },
  h2: { fontFamily: fonts.displayBold, fontSize: 23, lineHeight: 30 },
  lead: { fontSize: 16, lineHeight: 24 },
  section: { gap: space(1.25) },
  hero: { borderWidth: 1.5, borderRadius: 18, padding: space(2.5), gap: space(1.75) },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 0.7, lineHeight: 18 },
  note: { fontSize: 14, lineHeight: 21 },
});
