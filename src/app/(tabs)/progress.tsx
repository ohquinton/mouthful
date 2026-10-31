import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PACE_BANDS } from '../../engine/score';
import { contextOf, day1VsNow, heatStrip, paceContexts, personalBests, recent, retestDue, SpeakingContext } from '../../engine/progress';
import { loadSessions, SavedSession, streak } from '../../store/sessions';
import { useProfile } from '../../store/profile';
import { requirePro } from '../../pro';
import { FillerBars, HeatStrip, PaceChart } from '../../components/Charts';
import { PrimaryButton, ProBadge } from '../../components/ui';
import { ReplayButton } from '../../components/Replay';
import { fonts, space, useColors } from '../../theme';

const FREE_HISTORY = 7;
const CONTEXT_NAME: Record<SpeakingContext, string> = { reading: 'Reading', presenting: 'Presenting', talking: 'Talking' };
const CONTEXT_PHRASE: Record<SpeakingContext, string> = { reading: 'reading aloud', presenting: 'presenting', talking: 'talking' };

export default function Progress() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile } = useProfile();
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [paceCtx, setPaceCtx] = useState<SpeakingContext | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadSessions().then(setSessions);
    }, []),
  );

  const chartW = Math.min(width, 560) - space(2.5) * 2 - space(2) * 2;
  const shown = recent(sessions, profile.pro ? 30 : FREE_HISTORY);
  const { available: contexts, initial } = paceContexts(shown);
  const ctx = paceCtx && contexts.includes(paceCtx) ? paceCtx : initial;
  const paceShown = shown.filter((s) => contextOf(s) === ctx);
  const band = PACE_BANDS[ctx];
  const bests = personalBests(sessions);
  // One Minute sessions are left out of Best score: the Tape shows them as Flow, a different
  // 0–100 scale, so their old Free talk `score` would be a number the reader never saw.
  const bestScore = personalBests(sessions.filter((s) => s.kind !== 'minute')).bestScore;
  const cmp = day1VsNow(sessions, profile.baselineSessionId);
  const due = retestDue(sessions, profile.baselineSessionId);
  const { days } = streak(sessions);
  const day1Audio = (cmp?.day1 as SavedSession | undefined)?.recordings ?? [];
  const latestAudio = cmp && cmp.latest.passageId === cmp.day1.passageId ? (cmp.latest as SavedSession).recordings ?? [] : [];

  if (sessions.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <Text style={[styles.h1, { color: colors.ink }]}>Progress</Text>
        <Text style={[styles.lead, { color: colors.muted }]}>Nothing here yet. Your first read takes about a minute.</Text>
        <PrimaryButton label="Do today’s read" onPress={() => router.navigate('/')} />
      </View>
    );
  }

  const tiles = [
    { label: 'Best score', value: bestScore ?? '–' },
    { label: 'Fewest fillers', value: bests.cleanest !== undefined ? `${bests.cleanest}/min` : '–' },
    { label: 'Days practised', value: bests.totalDays },
    { label: 'Current streak', value: days },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.wrap, { paddingTop: insets.top + space(2), paddingBottom: space(4) }]}
    >
      <Text style={[styles.h1, { color: colors.ink }]}>Progress</Text>

      {due && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.eyebrow, { color: colors.cardMuted }]}>DAY {due} RE-TEST</Text>
          <Text style={[styles.cardTitle, { color: colors.cardInk }]}>Read your Day 1 passage again.</Text>
          <Text style={[styles.cardBody, { color: colors.cardMuted }]}>
            Same words, same mic.{profile.keepRecordings ? ' Afterwards you can play both recordings side by side.' : ' This is where you see the difference.'}
          </Text>
          <PrimaryButton label="Start the re-test" onPress={() => router.push({ pathname: '/session/[id]', params: { id: 'baseline', pace: 'reading' } })} />
        </View>
      )}

      {cmp && (
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>DAY 1 VS NOW · {cmp.daysBetween} {cmp.daysBetween === 1 ? 'DAY' : 'DAYS'}</Text>
          <View style={styles.vsRow}>
            {[
              { label: 'Pace', a: `${cmp.day1.wpm}`, b: `${cmp.latest.wpm}`, unit: 'wpm' },
              { label: 'Fillers', a: `${cmp.day1.fillersPerMin}`, b: `${cmp.latest.fillersPerMin}`, unit: '/min' },
              { label: 'Score', a: `${cmp.day1.score}`, b: `${cmp.latest.score}`, unit: '' },
            ].map((r) => (
              <View key={r.label} style={styles.vsCell}>
                <Text style={[styles.vsLabel, { color: colors.muted }]}>{r.label}</Text>
                <Text style={[styles.vsFrom, { color: colors.muted }]}>{r.a}</Text>
                <Text style={[styles.vsTo, { color: colors.ink }]}>
                  {r.b}
                  <Text style={[styles.vsUnit, { color: colors.muted }]}> {r.unit}</Text>
                </Text>
              </View>
            ))}
          </View>
          {day1Audio.length > 0 && (
            <View style={styles.replayRow}>
              <ReplayButton uris={day1Audio} label="Day 1" sub={`${cmp.day1.wpm} wpm`} />
              {latestAudio.length > 0 && <ReplayButton uris={latestAudio} label={`Day ${cmp.daysBetween + 1}`} sub={`${cmp.latest.wpm} wpm`} accent />}
            </View>
          )}
          {day1Audio.length > 0 && latestAudio.length === 0 && (
            <Text style={[styles.panelSub, { color: colors.muted }]}>Do the Day 7 re-test to hear the two side by side.</Text>
          )}
        </View>
      )}

      <View style={styles.tiles}>
        {tiles.map((t) => (
          <View key={t.label} style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[styles.tileLabel, { color: colors.muted }]}>{t.label}</Text>
            <Text style={[styles.tileValue, { color: colors.ink }]}>{t.value}</Text>
          </View>
        ))}
      </View>

      {shown.length >= 2 ? (
        <>
          <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[styles.panelTitle, { color: colors.ink }]}>Pace</Text>
            {contexts.length > 1 && (
              <View style={styles.chips} accessibilityRole="tablist">
                {contexts.map((c) => {
                  const on = c === ctx;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setPaceCtx(c)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                      style={[styles.chip, { borderColor: on ? colors.signal : colors.line, backgroundColor: on ? colors.signalSoft : colors.bg }]}
                    >
                      <Text style={[styles.chipText, { color: on ? colors.ink : colors.muted }]}>{CONTEXT_NAME[c]}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            <Text style={[styles.panelSub, { color: colors.muted }]}>
              Words per minute{contexts.length > 1 ? `, ${CONTEXT_PHRASE[ctx]} only` : ''}. Green band is the suggested {band[0]}–{band[1]} range for {CONTEXT_PHRASE[ctx]}.
            </Text>
            {paceShown.length >= 2 ? (
              <PaceChart values={paceShown.map((s) => s.wpm)} band={band} width={chartW} colors={colors} />
            ) : (
              <Text style={[styles.panelSub, { color: colors.muted }]}>One more {CONTEXT_PHRASE[ctx]} session and this chart appears.</Text>
            )}
          </View>
          <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[styles.panelTitle, { color: colors.ink }]}>Fillers per minute</Text>
            <Text style={[styles.panelSub, { color: colors.muted }]}>Lower is better.</Text>
            <FillerBars values={shown.map((s) => s.fillersPerMin)} width={chartW} colors={colors} />
          </View>
        </>
      ) : (
        <Text style={[styles.lead, { color: colors.muted }]}>Do one more session and your charts appear here.</Text>
      )}

      {!profile.pro && sessions.length > FREE_HISTORY && (
        <Pressable
          onPress={() => requirePro(profile, 'history')}
          style={[styles.upsell, { backgroundColor: colors.signalSoft }]}
        >
          <Text style={[styles.upsellText, { color: colors.ink }]}>
            Showing your last {FREE_HISTORY} sessions. See all {sessions.length}.
          </Text>
          <ProBadge />
        </Pressable>
      )}

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Text style={[styles.panelTitle, { color: colors.ink }]}>Last 12 weeks</Text>
        <Text style={[styles.panelSub, { color: colors.muted }]}>Each square is a day, Monday at the top.</Text>
        <HeatStrip grid={heatStrip(sessions)} width={chartW} colors={colors} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space(2.5), gap: space(2), maxWidth: 560, width: '100%', alignSelf: 'center' },
  empty: { flex: 1, padding: space(3), gap: space(2), justifyContent: 'center' },
  h1: { fontFamily: fonts.displayBold, fontSize: 32 },
  lead: { fontSize: 17, lineHeight: 24 },
  card: { borderRadius: 22, padding: space(2.5), gap: space(1.25) },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.1 },
  cardTitle: { fontFamily: fonts.readingBold, fontSize: 22 },
  cardBody: { fontSize: 15, lineHeight: 21, marginBottom: space(1) },
  panel: { borderWidth: 1, borderRadius: 18, padding: space(2), gap: space(1) },
  panelTitle: { fontSize: 17, fontWeight: '700' },
  panelSub: { fontSize: 13 },
  vsRow: { flexDirection: 'row', marginTop: space(1) },
  replayRow: { flexDirection: 'row', gap: space(1), marginTop: space(1.5) },
  vsCell: { flex: 1, gap: 2 },
  vsLabel: { fontSize: 13, fontWeight: '500' },
  vsFrom: { fontSize: 15, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] },
  vsTo: { fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  vsUnit: { fontSize: 13, fontWeight: '400' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.25) },
  tile: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 16, padding: space(1.75), gap: 2 },
  tileLabel: { fontSize: 13, fontWeight: '500' },
  tileValue: { fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  upsell: { flexDirection: 'row', alignItems: 'center', gap: space(1), borderRadius: 16, padding: space(2) },
  upsellText: { flex: 1, fontSize: 15, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1), marginTop: space(0.5) },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: space(1.5), paddingVertical: 6, minHeight: 34, justifyContent: 'center' },
  chipText: { fontSize: 14, fontWeight: '600' },
});
