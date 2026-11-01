import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  bestFlow,
  currentStopIndex,
  headerTitle,
  LESSON_KIND,
  lessonDoneToday,
  lessonIsPro,
  lessonTitle,
  LINE_NAME,
  LineId,
  lineOf,
  LINES,
  lineStarted,
  promptFor,
  startRoute,
  Stop,
  stopDoneToday,
  stopKind,
  withFirstTalk,
} from '../../content/lines';
import { minutePromptOfTheDay, Prompt } from '../../content/prompts';
import { FLOW_VERSION } from '../../engine/minute';
import type { WordBook } from '../../engine/vocab';
import { loadSessions, SavedSession, streak, thisWeek } from '../../store/sessions';
import { loadBook } from '../../store/words';
import { useProfile } from '../../store/profile';
import { ahaPaywallRoute, ahaPending, claimAhaPaywall } from '../../pro';
import { PlanCard } from '../../components/PlanCard';
import { HomeMap } from '../../components/HomeMap';
import { PrimaryButton, ProBadge, SecondaryButton } from '../../components/ui';
import { fonts, space, useColors } from '../../theme';

// Home: the two-line train map (docs/briefs/remodel-screens.md §2, DECISIONS 2026-11-01).
// "What do I do today?" is answered by one place on a line and one button. Progress is worked out
// from saved sessions (a stop is done when a session carries its stopId), so nothing new is stored.

/** "rain", "your phone": a level 1–2 topic reads as part of the sentence. */
const topicInline = (p: Prompt | undefined) => (p ? p.text.charAt(0).toLowerCase() + p.text.slice(1) : 'today’s topic');

export default function Home() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { profile, ready, update } = useProfile();
  const [saved, setSaved] = useState<SavedSession[]>([]);
  const [book, setBook] = useState<WordBook>({});
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => new Date());
  // Which line is on screen. Starts on the one chosen in onboarding; the other is one tap away.
  const [shownLine, setShownLine] = useState<LineId | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      Promise.all([loadSessions(), loadBook()]).then(([s, b]) => {
        if (!live) return;
        setSaved(s);
        setBook(b);
        setNow(new Date()); // the day may have changed while the app sat in the background
        setLoaded(true);
      });
      return () => {
        live = false;
      };
    }, []),
  );

  // The aha paywall, if the free run's Tape never got to open it (the app was killed there).
  // Once: claimAhaPaywall() for this launch (the Tape's Done lands here and has claimed it
  // already), ahaPaywallShown for good. Waits for the saved profile, so Pro isn't misread.
  const { pro, ahaPaywallShown, moment } = profile;
  useFocusEffect(
    useCallback(() => {
      if (!ready || pro || ahaPaywallShown) return;
      let live = true;
      loadSessions().then((all) => {
        const run = ahaPending({ profile: { pro, ahaPaywallShown }, sessions: all });
        if (!live || !run || !claimAhaPaywall()) return;
        update({ ahaPaywallShown: true });
        router.push(ahaPaywallRoute(run, moment));
      });
      return () => {
        live = false;
      };
    }, [ready, pro, ahaPaywallShown, moment, update]),
  );

  const chosen = lineOf(profile.line);
  // Onboarding's first talk is stop 1 of the line you picked (it's saved without a stopId).
  const sessions = useMemo(() => withFirstTalk(saved, chosen), [saved, chosen]);
  const line = shownLine ?? chosen;
  const other: LineId = line === 'sharp' ? 'clear' : 'sharp';
  // The Drop and the progress colour live on your line, and on the other one once you've started it.
  const active = line === chosen || lineStarted(line, sessions);
  const currentIndex = currentStopIndex(line, sessions);
  const stop: Stop | undefined = LINES[line][currentIndex];
  const todayDone = stopDoneToday(line, sessions, now);
  const lessonDone = !!stop?.lesson && lessonDoneToday(stop.lesson, { sessions, book }, now);
  const best = bestFlow(sessions, FLOW_VERSION);

  const { days, freezeUsed } = streak(sessions, now.getTime());
  const week = thisWeek(sessions, now);
  const weekDone = week.filter((d) => d.done).length;

  const start = useCallback(
    (s: Stop | undefined) => {
      if (!s) {
        // Past the last stop: topic talks keep coming daily, so the loop never stops.
        router.push({ pathname: '/talk', params: { prompt: minutePromptOfTheDay(now).id, seconds: '60', from: 'home' } });
        return;
      }
      router.push(startRoute(s, { pro: profile.pro, lessonDone }));
    },
    [now, profile.pro, lessonDone],
  );

  // Keep the current stop in view: scroll once each time the line or the stop changes.
  const scroll = useRef<ScrollViewInstance>(null);
  const viewport = useRef(0);
  const scrolledFor = useRef('');
  const onCurrentY = useCallback(
    (y: number) => {
      const key = `${line}:${currentIndex}`;
      if (scrolledFor.current === key || !viewport.current) return;
      const first = scrolledFor.current === '';
      scrolledFor.current = key;
      scroll.current?.scrollTo({ y: Math.max(0, y - viewport.current * 0.55), animated: !first && !reduceMotion });
    },
    [line, currentIndex, reduceMotion],
  );

  const card = (
    <TodayCard
      stop={stop}
      index={currentIndex}
      active={active}
      line={line}
      chosen={chosen}
      todayDone={todayDone}
      lessonDone={lessonDone}
      best={best}
      pro={profile.pro}
      now={now}
      onPress={() => start(stop)}
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + space(1.5) }]}>
      {/* Date, this week, and the streak in words. No emoji, no amber (Taste rule). */}
      <View style={styles.head}>
        <View style={styles.headTop}>
          <Text style={[styles.date, { color: colors.muted }]}>
            {now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </Text>
          <View style={styles.week} accessible accessibilityLabel={`${weekDone} of 7 days this week`}>
            {week.map((d, i) => (
              <View key={i} style={styles.day}>
                <View
                  style={[
                    styles.dayDot,
                    d.done
                      ? { backgroundColor: colors.ink, borderColor: colors.ink }
                      : { borderColor: d.today ? colors.ink : colors.line, borderWidth: d.today ? 2 : 1.5 },
                  ]}
                >
                  {d.done && <Ionicons name="checkmark" size={14} color={colors.bg} />}
                </View>
                <Text style={[styles.dayLabel, { color: d.today ? colors.ink : colors.muted }]}>{d.label}</Text>
              </View>
            ))}
          </View>
        </View>
        <Text style={[styles.title, { color: colors.ink }]} accessibilityRole="header">
          {headerTitle(sessions, days, now)}
        </Text>
        {freezeUsed && <Text style={[styles.freeze, { color: colors.muted }]}>Streak freeze used this week. You’re still on {days}.</Text>}
      </View>

      {/* Which line is on screen. A tab list to VoiceOver. */}
      <View style={[styles.switcher, { backgroundColor: colors.line }]} accessibilityRole="tablist">
        {(['sharp', 'clear'] as const).map((l, i) => {
          const on = l === line;
          return (
            <Pressable
              key={l}
              onPress={() => setShownLine(l)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${LINE_NAME[l]}, ${i + 1} of 2`}
              style={[styles.segment, on && { backgroundColor: colors.surface }]}
            >
              <View style={[styles.lineDot, { backgroundColor: colors[l] }]} />
              <Text style={[styles.segmentText, { color: on ? colors.ink : colors.muted }]} numberOfLines={1}>
                {LINE_NAME[l]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        ref={scroll}
        style={styles.mapScroll}
        onLayout={(e) => (viewport.current = e.nativeEvent.layout.height)}
        contentContainerStyle={{ paddingBottom: space(2) }}
      >
        {loaded && (
          <Animated.View key={line} entering={reduceMotion ? undefined : FadeIn.duration(200)}>
            <HomeMap
              line={line}
              sessions={sessions}
              currentIndex={currentIndex}
              todayDone={todayDone}
              active={active}
              dropMood={todayDone ? 'happy' : 'rest'}
              card={card}
              onSwitchLine={() => setShownLine(other)}
              onOpenSession={(id) => router.push({ pathname: '/tape', params: { id } })}
              onCurrentY={onCurrentY}
              now={now}
            />
          </Animated.View>
        )}
      </ScrollView>

      {/* Pinned: one button for today, then moments as a quiet row (or the active plan, small). */}
      <View style={[styles.bottom, { borderTopColor: colors.line }]}>
        {!active ? (
          <PrimaryButton label="Start this line" onPress={() => start(stop)} />
        ) : todayDone ? (
          <>
            <View style={styles.doneRow} accessible accessibilityLabel="Today’s stop is done. See you tomorrow.">
              <Ionicons name="checkmark" size={22} color={colors.good} />
              <Text style={[styles.doneText, { color: colors.ink }]}>Today’s stop is done. See you tomorrow.</Text>
            </View>
            <SecondaryButton label={stop ? 'Do the next stop now' : 'Talk again'} onPress={() => start(stop)} />
          </>
        ) : (
          <PrimaryButton label={stop ? 'Start today’s stop' : 'Start today’s talk'} onPress={() => start(stop)} />
        )}
        {moment ? (
          <PlanCard sessions={sessions} />
        ) : (
          <Pressable
            onPress={() => router.push('/moment')}
            accessibilityRole="button"
            accessibilityLabel="Got something coming up? Plan for it"
            style={({ pressed }) => [styles.planRow, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.muted} />
            <Text style={[styles.planText, { color: colors.muted }]}>
              Got something coming up? <Text style={[styles.planLink, { color: colors.ink }]}>Plan for it</Text>
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.ink} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** The card beside the current stop: what today's stop is, in one line, and a tap to start it. */
function TodayCard({
  stop,
  index,
  active,
  line,
  chosen,
  todayDone,
  lessonDone,
  best,
  pro,
  now,
  onPress,
}: {
  stop: Stop | undefined;
  index: number;
  active: boolean;
  line: LineId;
  chosen: LineId;
  todayDone: boolean;
  lessonDone: boolean;
  best: number | undefined;
  pro: boolean;
  now: Date;
  onPress: () => void;
}) {
  const colors = useColors();
  let eyebrow: string;
  let kind: string;
  let name: string;
  let sub: string;
  let proBadge = false;

  if (!active) {
    // The other line, never started. Its progress never takes from yours.
    eyebrow = 'STOP 1';
    kind = '';
    name = LINE_NAME[line];
    sub = `Your ${LINE_NAME[chosen]} progress stays where it is.`;
  } else if (!stop) {
    eyebrow = todayDone ? 'TOMORROW' : 'TODAY';
    kind = 'Topic talk';
    name = minutePromptOfTheDay(now).text;
    sub = 'You’ve reached the last stop so far. A new topic every day until more stops arrive.';
  } else {
    const prompt = promptFor(stop);
    eyebrow = `${todayDone ? 'TOMORROW' : 'TODAY'} · STOP ${index + 1}`;
    kind = LESSON_KIND[stopKind(stop)];
    const minute = index === 0 ? '30 seconds' : '1 minute';
    // A long topic (level 3) is a whole question, so it isn't folded into a sentence.
    const talkPart = prompt && prompt.level < 3 ? `${minute} on ${topicInline(prompt)}` : `a ${index === 0 ? '30-second' : '1-minute'} topic talk`;
    if (!stop.lesson) {
      name = prompt?.text ?? 'Today’s topic';
      sub = index === 0 ? '30 seconds. Your first talk.' : best !== undefined ? `1 minute. Your best is ${best}.` : '1 minute. Keep talking until the time is up.';
    } else {
      name = lessonTitle(stop.lesson);
      const locked = !pro && lessonIsPro(stop.lesson);
      proBadge = locked;
      if (locked) sub = `Today: ${talkPart}. The ${kind.toLowerCase()} comes with Pro.`;
      else if (lessonDone) sub = `${kind} done. Now ${talkPart}.`;
      else if (stop.lesson.kind === 'pack') sub = `Learn the words, then ${talkPart}.`;
      else sub = `Then ${talkPart}.`;
    }
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${eyebrow.toLowerCase()}, ${kind ? `${kind}: ${name}` : `Start ${name} here`}. ${sub}`}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.eyebrowRow}>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>{eyebrow}</Text>
        {proBadge && <ProBadge />}
      </View>
      {kind ? (
        <Text style={[styles.cardTitle, { color: colors.ink }]}>
          {kind}: <Text style={styles.cardName}>{name}</Text>
        </Text>
      ) : (
        <Text style={[styles.cardTitle, { color: colors.ink }]}>
          Start <Text style={styles.cardName}>{name}</Text> here.
        </Text>
      )}
      <Text style={[styles.cardSub, { color: colors.muted }]}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { paddingHorizontal: space(2.5), gap: 2 },
  headTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space(1) },
  date: { fontSize: 15, flexShrink: 1 },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, marginTop: space(0.5) },
  freeze: { fontSize: 14 },
  week: { flexDirection: 'row', gap: 5 },
  day: { alignItems: 'center', gap: 3 },
  dayDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  dayLabel: { fontSize: 10, fontWeight: '600' },
  switcher: { flexDirection: 'row', marginHorizontal: space(2.5), marginTop: space(1.5), borderRadius: 16, padding: 4 },
  segment: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderRadius: 12 },
  segmentText: { fontSize: 16, fontWeight: '700' },
  lineDot: { width: 12, height: 12, borderRadius: 6 },
  mapScroll: { flex: 1 },
  bottom: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: space(2.5), paddingTop: space(1.5), paddingBottom: space(1), gap: space(1) },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: space(1), paddingHorizontal: space(0.5) },
  doneText: { flex: 1, fontSize: 16, fontWeight: '600', lineHeight: 21 },
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44 },
  planText: { fontSize: 15, flexShrink: 1 },
  planLink: { fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 20, padding: space(2), gap: 4 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  cardTitle: { fontSize: 19, lineHeight: 25, fontWeight: '600' },
  cardName: { fontFamily: fonts.readingBold },
  cardSub: { fontSize: 15, lineHeight: 20 },
});
