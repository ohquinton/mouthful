import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { minutePromptOfTheDay } from '../../content/prompts';
import { dailyJourney, LINE_NAMES, PracticeLine } from '../../content/journey';
import { getMoment } from '../../content/moments';
import { PASSAGES, passageOfTheDay } from '../../content/passages';
import { loadSessions, SavedSession, streak, thisWeek } from '../../store/sessions';
import { useProfile } from '../../store/profile';
import { ahaPaywallRoute, ahaPending, claimAhaPaywall, requirePro } from '../../pro';
import { PlanCard } from '../../components/PlanCard';
import { PrimaryButton } from '../../components/ui';
import { LineMap } from '../../components/LineMap';
import { fonts, space, useColors } from '../../theme';

export default function Home() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, ready, update } = useProfile();
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(false);
  const [date, setDate] = useState(() => new Date());
  const [showPlan, setShowPlan] = useState(false);
  const line = profile.line ?? 'sharp';

  useFocusEffect(useCallback(() => {
    let live = true;
    setActive(true);
    setDate(new Date());
    loadSessions().then((all) => {
      if (live) { setSessions(all); setLoaded(true); }
    });
    // An open Home should move to the next day's topic without needing an app restart.
    const clock = setInterval(() => setDate(new Date()), 60_000);
    return () => { live = false; setActive(false); clearInterval(clock); };
  }, []));

  // Keep the existing own-script paywall recovery, even though plans no longer lead Home.
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

  const journey = dailyJourney(sessions, line, date);
  const tomorrow = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  const topic = minutePromptOfTheDay(date);
  const nextTopic = minutePromptOfTheDay(tomorrow);
  const { days, freezeUsed } = streak(sessions);
  const week = thisWeek(sessions);
  const activeMoment = getMoment(profile.moment?.id);
  const last = sessions[sessions.length - 1];
  const readIds = new Set(sessions.map((s) => s.passageId));
  const dailyRead = passageOfTheDay();
  const unseen = PASSAGES.find((p) => !readIds.has(p.id) && p.id !== dailyRead.id) ?? PASSAGES[0];
  const start = () => router.push({ pathname: '/talk', params: { stopId: journey.id } });

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[styles.wrap, { paddingTop: insets.top + space(2), paddingBottom: space(4) }]}>
      <View style={styles.header}>
        <Text style={[styles.date, { color: colors.muted }]}>{date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>Find your words.</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>A little practice. A little more you.</Text>
      </View>

      <View style={styles.weekHeader}>
        <Text style={[styles.weekTitle, { color: colors.ink }]}>{loaded ? (days > 1 ? `${days} days in a row` : 'Your week') : 'Your week'}</Text>
        {loaded && <Text style={[styles.weekMeta, { color: colors.muted }]}>{week.filter((d) => d.done).length} of 7 days</Text>}
      </View>
      <View style={styles.week}>
        {week.map((day, i) => (
          <View key={i} accessible accessibilityLabel={`${day.label}${day.today ? ', today' : ''}, ${loaded && day.done ? 'practised' : 'not completed'}`} style={styles.day}>
            <View style={[styles.dayDot, { backgroundColor: loaded && day.done ? colors.ink : colors.surface, borderColor: day.today ? colors.ink : colors.line, borderWidth: day.today ? 2 : 1 }]}>
              {loaded && day.done && <Ionicons name="checkmark" size={15} color={colors.bg} />}
              {(!loaded || !day.done) && day.today && <View style={[styles.todayDot, { backgroundColor: colors.ink }]} />}
            </View>
            <Text style={[styles.dayLabel, { color: day.today ? colors.ink : colors.muted }]}>{day.label}</Text>
          </View>
        ))}
      </View>
      {freezeUsed && <Text style={[styles.note, { color: colors.muted }]}>Your streak freeze covered a missed day this week.</Text>}

      <View style={[styles.switcher, { backgroundColor: colors.line }]} accessibilityRole="radiogroup" accessibilityLabel="Practice line">
        {(['sharp', 'clear'] as PracticeLine[]).map((choice) => (
          <Pressable key={choice} onPress={() => update({ line: choice })} accessibilityRole="radio" accessibilityState={{ checked: line === choice }} accessibilityLabel={LINE_NAMES[choice]} style={({ pressed }) => [styles.lineChoice, { backgroundColor: line === choice ? colors.surface : 'transparent', opacity: pressed ? 0.7 : 1 }]}>
            <View style={[styles.lineDot, { backgroundColor: colors[choice] }]} />
            <Text style={[styles.lineName, { color: line === choice ? colors.ink : colors.muted }]}>{LINE_NAMES[choice]}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.lineDescription, { color: colors.muted }]}>{line === 'sharp' ? 'Find precise words. Make your point.' : 'Everyday English. More ease in every conversation.'}</Text>

      {loaded ? (
        <LineMap key={line} line={line} topic={journey.today?.title ?? topic.text} tomorrow={nextTopic.text} done={!!journey.today} previous={journey.previous} active={active} />
      ) : (
        <View style={styles.loading}><Text accessibilityRole="text" style={[styles.subtitle, { color: colors.muted }]}>Finding your place…</Text></View>
      )}
      <View style={styles.action}>
        {journey.today && <Text accessibilityLiveRegion="polite" style={[styles.complete, { color: colors[line] }]}>✓ Today’s stop is done. See you tomorrow.</Text>}
        <PrimaryButton label={journey.today ? 'Talk again' : 'Start today’s stop'} onPress={start} disabled={!loaded || !ready} />
        <Text style={[styles.actionNote, { color: colors.muted }]}>{journey.today ? 'Another try stays on today’s stop.' : 'One topic. One minute. Start where you are.'}</Text>
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push('/moment')} style={({ pressed }) => [styles.planLink, { opacity: pressed ? 0.65 : 1 }]}>
        <Ionicons name="calendar-outline" size={18} color={colors.muted} />
        <Text style={[styles.planText, { color: colors.muted }]}>Something coming up? <Text style={{ color: colors.ink, fontWeight: '700' }}>Plan for it</Text></Text>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </Pressable>
      {activeMoment && (
        <View>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showPlan }} onPress={() => setShowPlan((value) => !value)} style={[styles.activePlan, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.eyebrow, { color: colors.muted }]}>YOUR ACTIVE PLAN</Text>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>{activeMoment.title}</Text>
            </View>
            <Ionicons name={showPlan ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
          </Pressable>
          {showPlan && <View style={{ marginTop: 12 }}><PlanCard sessions={sessions} /></View>}
        </View>
      )}
      <View style={[styles.more, { borderTopColor: colors.line }]}>
        <Text style={[styles.weekTitle, { color: colors.ink }]}>Keep exploring</Text>
        <View style={styles.exploreLinks}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/library')} style={styles.exploreLink}><Ionicons name="book-outline" size={19} color={colors.muted} /><Text style={[styles.rowTitle, { color: colors.ink }]}>Words & reading</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/scripts')} style={styles.exploreLink}><Ionicons name="document-text-outline" size={19} color={colors.muted} /><Text style={[styles.rowTitle, { color: colors.ink }]}>Your scripts</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Cold read${profile.pro ? '' : ', Pro'}`} onPress={() => requirePro(profile, 'cold') && router.push({ pathname: '/session/[id]', params: { id: unseen.id, cold: '1' } })} style={styles.exploreLink}><Ionicons name="eye-outline" size={19} color={colors.muted} /><Text style={[styles.rowTitle, { color: colors.ink }]}>Cold read{profile.pro ? '' : ' · Pro'}</Text></Pressable>
        </View>
        {last && last.stumbled.length > 0 && <Pressable accessibilityRole="button" onPress={() => requirePro(profile, 'fixit') && router.push({ pathname: '/fixit', params: { sid: last.id } })} style={styles.exploreLink}><Ionicons name="refresh-outline" size={19} color={colors.muted} /><Text style={[styles.rowTitle, { color: colors.ink }]}>Revisit missed words{profile.pro ? '' : ' · Pro'}</Text></Pressable>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space(2.5), gap: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  header: { gap: 6, marginBottom: 6 },
  date: { fontSize: 13, lineHeight: 19 },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  weekTitle: { fontSize: 15, fontWeight: '700' },
  weekMeta: { fontSize: 12 },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4, marginBottom: 4 },
  day: { alignItems: 'center', gap: 6 },
  dayDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  todayDot: { width: 5, height: 5, borderRadius: 3 },
  dayLabel: { fontSize: 10, fontWeight: '600' },
  note: { fontSize: 12, lineHeight: 18 },
  switcher: { flexDirection: 'row', padding: 4, borderRadius: 16, gap: 4 },
  lineChoice: { flex: 1, minHeight: 46, padding: 9, gap: 7, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  lineDot: { width: 8, height: 8, borderRadius: 4 },
  lineName: { flexShrink: 1, fontSize: 14, fontWeight: '700' },
  lineDescription: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: -6, marginBottom: 4 },
  loading: { minHeight: 300, alignItems: 'center', justifyContent: 'center' },
  action: { gap: 12, marginTop: 8 },
  complete: { fontSize: 14, fontWeight: '600', lineHeight: 21, textAlign: 'center' },
  actionNote: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  planLink: { minHeight: 48, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  planText: { fontSize: 13, lineHeight: 20, flexShrink: 1 },
  activePlan: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 16 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  more: { borderTopWidth: 1, paddingTop: 20, gap: 8 },
  exploreLinks: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 22 },
  exploreLink: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 48 },
});
