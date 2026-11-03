import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useProfile } from '../../store/profile';
import { useExperience } from '../../store/experience';
import { EXPERIENCES, experienceTopic } from '../../content/experiences';
import { loadBook } from '../../store/words';
import { loadSessions, type SavedSession } from '../../store/sessions';
import { summarise, type WordBook } from '../../engine/vocab';
import { ahaPaywallRoute, ahaPending, claimAhaPaywall } from '../../pro';
import { ShelfRow } from '../../components/library/ShelfRow';
import { Drop } from '../../components/Drop';
import { PlanCard } from '../../components/PlanCard';
import { BRAND } from '../../brand';
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
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.25;

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);

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
  const soft = colors[english ? 'clearSoft' : 'sharpSoft'];
  const { learning, comfortable } = summarise(book);
  const wordCount = learning.length + comfortable.length;
  const startTalk = () => router.push({ pathname: '/talk', params: { prompt: topic.id, seconds: '60', from: 'home' } });
  const openReading = () => router.push({ pathname: '/session/[id]', params: { id: 'w.meetings.0' } });

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[styles.wrap, { paddingTop: insets.top + space(2), paddingBottom: space(4) }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.brand, { color: colors.muted }]}>{BRAND.name}</Text>
          <Text accessibilityRole="header" style={[styles.experience, { color: colors.ink }]}>{experience.name}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Switch between Articulation and English Speaking" onPress={showChoices} style={({ pressed }) => [styles.switch, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.65 : 1 }]}>
          <Ionicons name="swap-horizontal" size={18} color={accent} />
          <Text style={[styles.switchText, { color: colors.ink }]}>Switch</Text>
        </Pressable>
      </View>
      <View style={styles.section}>
        <Text style={[styles.date, { color: colors.muted }]}>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>{english ? 'A little practice.\nMore ease in English.' : 'Your ideas.\nSaid a little clearer.'}</Text>
      </View>
      <View style={[styles.hero, { backgroundColor: soft }]}>
        <View style={styles.heroTop}>
          <Text style={[styles.eyebrow, { color: colors.ink }]}>{english ? 'READ IT. SAY IT.' : 'YOUR DAILY TOPIC'}</Text>
          <View style={[styles.badge, { backgroundColor: colors.surface }]}><Text style={[styles.badgeText, { color: accent }]}>FREE</Text></View>
        </View>
        <View style={[styles.heroBody, stacked && styles.heroStacked]}>
          <View style={[styles.heroCopy, stacked && styles.heroCopyStacked]}>
            <Text accessibilityRole="header" style={[styles.heroTitle, { color: colors.ink }]}>{english ? 'Opening a meeting' : topic.text}</Text>
            <Text style={[styles.heroMeta, { color: colors.ink }]}>{english ? 'Guided reading · useful phrases' : '1 minute · speak in your own words'}</Text>
          </View>
          <View style={styles.coach}>
            <Drop height={stacked ? 76 : 104} pose="up" tilt={english ? 5 : -5} alive={focused && active} />
          </View>
        </View>
        <Text style={[styles.heroDescription, { color: colors.ink }]}>{english ? 'Follow the words as you read aloud. Try a tricky word again, then put it in a sentence.' : 'One idea is enough to begin. Afterwards, explore your pace, repeated words and fillers the phone heard.'}</Text>
        <Pressable accessibilityRole="button" onPress={english ? openReading : startTalk} style={({ pressed }) => [styles.start, { backgroundColor: accent, opacity: pressed ? 0.8 : 1 }]}>
          <Text style={[styles.startText, { color: colors.onLine }]}>{english ? 'Let’s read aloud' : 'Let’s talk'}</Text>
          <Ionicons name="arrow-forward" size={21} color={colors.onLine} />
        </Pressable>
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.h2, { color: colors.ink }]}>{english ? 'Make English your own' : 'What will you work on?'}</Text>
        {english ? (
          <>
            <View style={[styles.activities, stacked && styles.activityStack]}>
              <ActivityCard icon="chatbubble-ellipses-outline" title="Everyday talk" detail={`Talk about ${topic.text.charAt(0).toLowerCase() + topic.text.slice(1)}. Starter ideas are there if you need them.`} label="1-minute talk" accent={accent} soft={soft} stacked={stacked} onPress={startTalk} />
              <ActivityCard icon="book-outline" title="Useful words" detail="Hear a word. Learn its meaning. Say it in context." label="Free word pack" accent={accent} soft={soft} stacked={stacked} onPress={() => router.push({ pathname: '/pack/[id]', params: { id: 'meetings' } })} />
            </View>
            <ShelfRow icon="library-outline" title="English practice library" meta="Everyday topics, guided passages and word packs." onPress={() => router.push('/library')} />
          </>
        ) : (
          <>
            <View style={[styles.activities, stacked && styles.activityStack]}>
              <ActivityCard icon="chatbubbles-outline" title="Think on your feet" detail="Explain an idea. Tell a story. Make your case." label="Explore topics" accent={accent} soft={soft} stacked={stacked} onPress={() => router.push('/library')} />
              <ActivityCard icon="book-outline" title="Find the word" detail="Learn a precise word, then make it your own." label="Free word pack" accent={accent} soft={soft} stacked={stacked} onPress={() => router.push({ pathname: '/pack/[id]', params: { id: 'precision' } })} />
            </View>
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

function ActivityCard({ icon, title, detail, label, accent, soft, stacked, onPress }: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  detail: string;
  label: string;
  accent: string;
  soft: string;
  stacked: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${detail} ${label}.`} onPress={onPress}
      style={({ pressed }) => [styles.activity, stacked && styles.activityFull, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.75 : 1 }]}>
      <View style={[styles.activityIcon, { backgroundColor: soft }]}><Ionicons name={icon} size={27} color={colors.ink} /></View>
      <Text style={[styles.activityTitle, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.activityDetail, { color: colors.muted }]}>{detail}</Text>
      <View style={styles.activityFoot}>
        <Text style={[styles.activityLabel, { color: accent }]}>{label}</Text>
        <Ionicons name="arrow-forward" size={17} color={accent} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space(2.5), gap: space(3), width: '100%', maxWidth: 620, alignSelf: 'center' },
  header: { flexDirection: 'row', gap: space(1.25), alignItems: 'center', flexWrap: 'wrap' },
  headerText: { flexGrow: 1, flexShrink: 1, gap: 3 },
  brand: { fontSize: 12, fontWeight: '600', lineHeight: 18 },
  experience: { fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 29 },
  switch: { minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 24, paddingHorizontal: space(1.5) },
  switchText: { fontSize: 13, fontWeight: '600' },
  date: { fontSize: 13, lineHeight: 20 },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 39, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.displayBold, fontSize: 23, lineHeight: 30 },
  section: { gap: space(1.25) },
  hero: { borderRadius: 26, padding: space(2.5), gap: space(2) },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space(1), justifyContent: 'space-between', flexWrap: 'wrap' },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 0.7, lineHeight: 18 },
  badge: { borderRadius: 8, paddingHorizontal: space(1), paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  heroStacked: { flexDirection: 'column-reverse', alignItems: 'flex-start' },
  heroCopy: { flex: 1, gap: space(1), minWidth: 0 },
  heroCopyStacked: { flex: undefined, width: '100%' },
  heroTitle: { fontFamily: fonts.display, fontSize: 28, lineHeight: 35, letterSpacing: -0.4 },
  heroMeta: { fontSize: 13, lineHeight: 20, fontWeight: '500' },
  coach: { paddingHorizontal: 4, paddingVertical: 2 },
  heroDescription: { fontSize: 15, lineHeight: 22 },
  start: { minHeight: 54, borderRadius: 16, paddingVertical: space(1.75), paddingHorizontal: space(2), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(1) },
  startText: { fontSize: 17, lineHeight: 24, fontWeight: '700', flexShrink: 1 },
  activities: { flexDirection: 'row', gap: space(1.25), alignItems: 'stretch' },
  activityStack: { flexDirection: 'column' },
  activity: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 20, padding: space(1.75), gap: space(1.25) },
  activityFull: { flex: undefined },
  activityIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  activityTitle: { fontFamily: fonts.displayBold, fontSize: 20, lineHeight: 25 },
  activityDetail: { fontSize: 14, lineHeight: 20 },
  activityFoot: { marginTop: 'auto', paddingTop: space(1), flexDirection: 'row', gap: 5, alignItems: 'center' },
  activityLabel: { fontSize: 12, lineHeight: 18, fontWeight: '700', flex: 1 },
  note: { fontSize: 14, lineHeight: 21 },
});
