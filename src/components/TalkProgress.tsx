import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { FLOW_VERSION, minuteTrend } from '../engine/minute';
import { isShortTalk } from '../store/minute';
import type { SavedSession } from '../store/sessions';
import { fonts, space, useColors } from '../theme';
import { PrimaryButton } from './ui';

/** A person's own topic talks. Reading scores and older Flow formulas never enter this summary. */
export function TalkProgress({ sessions, limit }: { sessions: SavedSession[]; limit: number }) {
  const colors = useColors();
  const talks = sessions.filter((s) => s.kind === 'minute' && Number.isFinite(s.flow)).sort((a, b) => a.at - b.at);
  const current = talks.filter((s) => s.flowVersion === FLOW_VERSION && !isShortTalk(s));
  const trend = minuteTrend(current.map((s) => ({ ...s, timeToFirstWordSeconds: s.minute?.timeToFirstWordSeconds })), FLOW_VERSION);
  const latest = current.at(-1);
  const recent = talks.slice(-limit).reverse();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.eyebrow, { color: colors.muted }]}>YOUR VOICE, OVER TIME</Text>
      <Text style={[styles.title, { color: colors.ink }]}>
        {talks.length === 0 ? 'Start with one minute.' : talks.length === 1 ? 'Your first talk is here.' : `${talks.length} talks. Your own progress.`}
      </Text>
      <Text style={[styles.body, { color: colors.muted }]}>
        {current.length < 3 ? 'Keep a few talks here to find your usual Flow. You are only compared with yourself.' : `Your usual is the middle of your last ${trend?.count ?? 5} comparable talks.`}
      </Text>
      {latest && (
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[styles.label, { color: colors.muted }]}>{trend ? 'Your usual Flow' : 'Latest Flow'}</Text>
          <Text style={[styles.number, { color: colors.ink }]}>{trend ? Math.round(trend.median) : latest.flow}</Text>
          <Text style={[styles.body, { color: colors.muted }]}>Flow describes how you kept talking. It is not a grade of your accent or your English.</Text>
          {trend?.firstWord && <Text style={[styles.first, { color: colors.ink }]}>You usually start after {trend.firstWord.median.toFixed(1)} seconds.</Text>}
        </View>
      )}
      {recent.length > 0 && (
        <View style={[styles.history, { borderColor: colors.line, backgroundColor: colors.surface }]}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>{talks.length > limit ? `LATEST ${limit} TOPIC TALKS` : 'RECENT TOPIC TALKS'}</Text>
          {recent.map((s) => (
            <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`${s.title}, Flow ${s.flow}. View this talk.`}
              onPress={() => router.push({ pathname: '/tape', params: { id: s.id } })}
              style={({ pressed }) => [styles.row, { borderTopColor: colors.line, opacity: pressed ? 0.65 : 1 }]}>
              <View style={styles.rowText}>
                <Text style={[styles.topic, { color: colors.ink }]}>{s.title}</Text>
                <Text style={[styles.date, { color: colors.muted }]}>{new Date(s.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{s.flowVersion !== FLOW_VERSION ? ' · Earlier Flow version' : ''}</Text>
              </View>
              <Text style={[styles.flow, { color: colors.ink }]}>{s.flow}<Text style={styles.flowUnit}> Flow</Text></Text>
            </Pressable>
          ))}
        </View>
      )}
      <PrimaryButton label="Go to today’s stop" onPress={() => router.navigate('/')} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space(1.5) },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  title: { fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 34 },
  body: { fontSize: 15, lineHeight: 23 },
  hero: { padding: space(2.5), borderWidth: 1, borderRadius: 24, gap: space(1) },
  label: { fontSize: 15, fontWeight: '600' },
  number: { fontFamily: fonts.displayBold, fontSize: 64, lineHeight: 76 },
  first: { fontSize: 15, lineHeight: 22, marginTop: space(1) },
  history: { borderWidth: 1, borderRadius: 20, padding: space(2), gap: space(1.5) },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space(1), paddingTop: space(1.5), minHeight: 60, borderTopWidth: StyleSheet.hairlineWidth },
  rowText: { flex: 1, minWidth: 140, gap: 4 },
  topic: { fontFamily: fonts.readingBold, fontSize: 17 },
  date: { fontSize: 12, lineHeight: 18 },
  flow: { fontFamily: fonts.displayBold, fontSize: 24 },
  flowUnit: { fontSize: 12 },
});
