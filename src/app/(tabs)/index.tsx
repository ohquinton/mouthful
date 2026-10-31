import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { estimateSeconds, formatDuration as duration, PASSAGES, passageOfTheDay } from '../../content/passages';
import { MOMENTS } from '../../content/moments';
import { minutePromptOfTheDay } from '../../content/prompts';
import { loadSessions, SavedSession, streak, thisWeek } from '../../store/sessions';
import { useProfile } from '../../store/profile';
import { ahaPaywallRoute, ahaPending, claimAhaPaywall, requirePro } from '../../pro';
import { PlanCard } from '../../components/PlanCard';
import { streakPillShown } from '../../onboarding';
import { ProBadge } from '../../components/ui';
import { fonts, space, useColors } from '../../theme';

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
}

export default function Today() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, ready, update } = useProfile();
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const today = passageOfTheDay();

  useFocusEffect(
    useCallback(() => {
      loadSessions().then(setSessions);
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

  const { days, freezeUsed } = streak(sessions);
  const week = thisWeek(sessions);
  const doneToday = sessions.some((s) => s.passageId === today.id && new Date(s.at).toDateString() === new Date().toDateString());
  const last = sessions[sessions.length - 1];
  // Cold read uses a passage the reader hasn't opened yet.
  const readIds = new Set(sessions.map((s) => s.passageId));
  const unseen = PASSAGES.find((p) => !readIds.has(p.id) && p.id !== today.id) ?? PASSAGES[(PASSAGES.indexOf(today) + 1) % PASSAGES.length];

  // Tester mode: Free talk is One Minute (beta first, then everyone), showing the day's word.
  const minute = profile.testerMode === true;
  const tiles = [
    {
      key: 'vocabulary',
      title: 'Vocabulary',
      sub: 'Find precise words. Make them your own.',
      icon: 'book-outline' as const,
      badge: false,
      onPress: () => router.push('/(tabs)/library'),
    },
    {
      key: 'scripts',
      title: 'Your scripts',
      sub: 'Paste it, rehearse it',
      icon: 'document-text-outline' as const,
      badge: !profile.pro,
      // Free readers can open the list: their first script is free. "Paste a script" walls the second.
      onPress: () => router.push('/scripts'),
    },
    {
      key: 'talk',
      title: minute ? 'One Minute' : 'Free talk',
      sub: minute ? `Today: ${minutePromptOfTheDay().text}` : '60 seconds, no script',
      icon: 'chatbubble-ellipses-outline' as const,
      badge: false,
      onPress: () => router.push('/talk'),
    },
    {
      key: 'cold',
      title: 'Cold read',
      sub: 'Unseen passage',
      icon: 'eye-off-outline' as const,
      // Pro only, like Scripts. No streak lock: being locked twice read as bait.
      badge: !profile.pro,
      onPress: () => requirePro(profile, 'cold') && router.push({ pathname: '/session/[id]', params: { id: unseen.id, cold: '1' } }),
    },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.wrap, { paddingTop: insets.top + space(2), paddingBottom: space(4) }]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.date, { color: colors.muted }]}>
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </Text>
          <Text style={[styles.hello, { color: colors.ink }]}>{greeting()}.</Text>
        </View>
        {/* Hidden until day 2: a streak of 1 on the first day says nothing. */}
        {streakPillShown(days) && (
          <View style={[styles.streak, { borderColor: colors.line, backgroundColor: colors.surface }]}>
            <Text style={[styles.streakText, { color: colors.ember }]}>🔥 {days}</Text>
          </View>
        )}
      </View>
      {freezeUsed && <Text style={[styles.freeze, { color: colors.muted }]}>Streak freeze used this week. You’re still on {days}.</Text>}

      {/* What you're preparing for comes first */}
      {profile.moment ? (
        <PlanCard sessions={sessions} />
      ) : (
        <View style={[styles.prep, { backgroundColor: colors.card }]}>
          <Text style={[styles.prepTitle, { color: colors.cardInk }]}>What are you preparing for?</Text>
          <Text style={[styles.prepSub, { color: colors.cardMuted }]}>Get a five-step plan for the moment that matters.</Text>
          <View style={styles.prepGrid}>
            {MOMENTS.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => router.push({ pathname: '/moment', params: { id: m.id } })}
                style={({ pressed }) => [styles.prepTile, { backgroundColor: 'rgba(255,255,255,0.07)', opacity: pressed ? 0.75 : 1 }]}
              >
                <Ionicons name={m.icon} size={20} color={colors.cardInk} />
                <Text style={[styles.prepTileText, { color: colors.cardInk }]}>{m.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Daily warm-up: the habit between big moments */}
      <Pressable
        onPress={() => router.push({ pathname: '/session/[id]', params: { id: today.id } })}
        style={({ pressed }) => [styles.warmup, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.8 : 1 }]}
      >
        <View style={[styles.warmIcon, { backgroundColor: colors.signalSoft }]}>
          <Ionicons name={doneToday ? 'checkmark' : 'mic'} size={20} color={colors.signal} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.warmEyebrow, { color: colors.muted }]}>
            DAILY WARM-UP · {duration(estimateSeconds(today.text))}
          </Text>
          <Text style={[styles.warmTitle, { color: colors.ink }]} numberOfLines={1}>
            {today.title}
          </Text>
        </View>
        <Text style={[styles.warmGo, { color: colors.signal }]}>{doneToday ? 'Again' : 'Read'}</Text>
      </Pressable>

      <Text style={[styles.section, { color: colors.ink }]}>Ways to practise</Text>
      <View style={styles.tiles}>
        {tiles.map((t) => (
          <Pressable
            key={t.key}
            onPress={t.onPress}
            accessibilityRole="button"
            style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.75 : 1 }]}
          >
            <View style={styles.tileTop}>
              <Ionicons name={t.icon} size={22} color={colors.signal} />
              {t.badge && <ProBadge />}
            </View>
            <Text style={[styles.tileTitle, { color: colors.ink }]}>{t.title}</Text>
            <Text style={[styles.tileSub, { color: colors.muted }]}>
              {t.sub}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* This week */}
      <Text style={[styles.section, { color: colors.ink }]}>This week</Text>
      <View style={[styles.week, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {week.map((d, i) => (
          <View key={i} style={styles.day}>
            <Text style={[styles.dayLabel, { color: d.today ? colors.ink : colors.muted }]}>{d.label}</Text>
            <View
              style={[
                styles.dayDot,
                d.done
                  ? { backgroundColor: colors.ink }
                  : d.today
                    ? { borderWidth: 1.5, borderColor: colors.signal, borderStyle: 'dashed' }
                    : { backgroundColor: colors.line },
              ]}
            >
              {d.done && <Ionicons name="checkmark" size={16} color={colors.bg} />}
            </View>
          </View>
        ))}
      </View>

      {/* Leftover work from last time */}
      {last && last.stumbled.length > 0 && (
        <Pressable
          onPress={() => requirePro(profile, 'fixit') && router.push({ pathname: '/fixit', params: { sid: last.id } })}
          style={({ pressed }) => [styles.fixRow, { backgroundColor: colors.signalSoft, opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="pulse" size={22} color={colors.signal} />
          <Text style={[styles.fixText, { color: colors.ink }]} numberOfLines={2}>
            Practise last time’s missed words: {last.stumbled.map((w) => `“${w}”`).join(', ')}
          </Text>
          {!profile.pro && <ProBadge />}
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space(2.5), gap: space(2) },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  date: { fontSize: 15 },
  hello: { fontFamily: fonts.displayBold, fontSize: 32 },
  streak: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  streakText: { fontSize: 16, fontWeight: '700' },
  freeze: { fontSize: 14, marginTop: -space(1) },
  prep: { borderRadius: 24, padding: space(2.5), gap: space(1) },
  prepTitle: { fontFamily: fonts.readingBold, fontSize: 24, lineHeight: 30 },
  prepSub: { fontSize: 15, lineHeight: 21 },
  prepGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1), marginTop: space(1) },
  prepTile: { flexBasis: '47%', flexGrow: 1, borderRadius: 14, padding: space(1.5), gap: 6, minHeight: 72 },
  prepTileText: { fontSize: 15, fontWeight: '600' },
  warmup: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), borderWidth: 1, borderRadius: 18, padding: space(1.75) },
  warmIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  warmEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9 },
  warmTitle: { fontFamily: fonts.readingBold, fontSize: 18, marginTop: 2 },
  warmGo: { fontSize: 15, fontWeight: '700' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.25) },
  tile: { flexBasis: '47%', flexGrow: 1, flexShrink: 1, minWidth: 140, borderWidth: 1, borderRadius: 18, padding: space(1.5), gap: 4, minHeight: 124 },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  tileTitle: { fontSize: 15, fontWeight: '700' },
  tileSub: { fontSize: 13, lineHeight: 17 },
  section: { fontSize: 17, fontWeight: '700', marginTop: space(1) },
  week: { flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderRadius: 18, padding: space(2) },
  day: { alignItems: 'center', gap: 8 },
  dayLabel: { fontSize: 13, fontWeight: '600' },
  dayDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  fixRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), borderRadius: 18, padding: space(2) },
  fixText: { flex: 1, fontSize: 15, fontWeight: '500' },
});
