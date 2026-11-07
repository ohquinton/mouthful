import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { PACE_BANDS, paceZone } from '../engine/score';
import type { HabitWord } from '../engine/habits';
import type { SavedSession } from '../store/sessions';
import {
  fillerChips,
  firstWordSeconds,
  isShortTalk,
  mainFinding,
  nextAfterTalk,
  stoppedEarly,
  stripText,
  topRepeated,
  usualFor,
  usualText,
  varietyText,
  weeklyVariety,
  wholeSeconds,
  type MinuteRecord,
} from '../store/minute';
import { promptById } from '../content/prompts';
import { Drop } from './Drop';
import { Colors, fonts, space } from '../theme';

/** Always under the number (brief, Decision 3). Flow is about keeping going, never about how you sound. */
export const FLOW_FINE_PRINT = 'Flow is whether you kept talking. It isn’t a grade of your accent or your English.';

// Timings (docs/design/RESULTS-ANIMATIONS.md). One celebration: the count. Everything else is a fade.
const COUNT_MS = 700;
const TILE_STAGGER_MS = 100;
const FINDING_AT_MS = COUNT_MS + 50;
const NOD_AT_MS = FINDING_AT_MS + 350;

/**
 * A button that presses to 0.97 with a light haptic (RESULTS-ANIMATIONS §6). No larger scale.
 * Haptics fail quietly on web.
 */
export function PressScale({ onPress, children, style, label }: { onPress: () => void; children: ReactNode; style?: object; label: string }) {
  const still = useReducedMotion();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={() => {
        if (!still) scale.set(withTiming(0.97, { duration: 90 }));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }}
      onPressOut={() => scale.set(withTiming(1, { duration: 120 }))}
      onPress={onPress}
    >
      <Animated.View style={[style, anim]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Flow, counting up once from `from` to `to` (ease out), then following `to` at once (e.g. "I meant that"). */
function useCountUp(from: number, to: number, still: boolean): number {
  const [shown, setShown] = useState(still ? to : from);
  const v = useSharedValue(still ? to : from);
  const first = useRef(true);
  useAnimatedReaction(
    () => Math.round(v.value),
    (now, before) => {
      if (now !== before) scheduleOnRN(setShown, now);
    },
  );
  useEffect(() => {
    // The first value counts up; a later change (an "I meant that" tap) just moves to it.
    if (first.current && !still) v.set(withTiming(to, { duration: COUNT_MS, easing: Easing.out(Easing.cubic) }));
    else v.set(to);
    first.current = false;
  }, [to, still, v]);
  return shown;
}

/**
 * The results for a topic talk (remodel-screens §4, simplified as approved 2026-11-01): the Flow
 * count with the change on your usual, the fine print, the one most useful finding with the Drop,
 * what comes tomorrow, the next action and Done, then "The details" (fillers, repeated words, kept going, first
 * word, pace, and the week's vocabulary variety once there's enough to pool). Everything comes from
 * the saved numbers; the transcript is never stored. Never looks like a failure: a talk that stopped
 * early gets the encouraging line, no arrow, and its stop still counts.
 */
export function MinuteResult({
  s,
  all,
  onMeant,
  onBack,
  onAgain,
  onPoint,
  colors,
}: {
  s: SavedSession;
  /** Every saved session, oldest first: for your usual and the week's variety. */
  all: SavedSession[];
  /** "I meant that" on a likely filler chip: the earliest standing occurrence of that word. */
  onMeant: (index: number, word: HabitWord) => void;
  onBack: () => void;
  onAgain: () => void;
  /** Open Make your point. */
  onPoint: () => void;
  colors: Colors;
}) {
  const still = useReducedMotion();
  const m = s.minute as MinuteRecord;
  const limit = m.limitSeconds ?? 60;
  const short = isShortTalk(s);
  const flow = s.flow ?? 0;
  const early = stoppedEarly(s);
  const next = nextAfterTalk(s);
  const usual = usualFor(s, all);
  // Null for a 30-second talk: it never gets a usual, so no countdown to one.
  const under = usualText(usual, early, short);
  // Count from your usual (or 0 the first time): the number lands where you are against yourself.
  const [from] = useState(() => (usual.trend ? Math.round(usual.trend.median) : 0));
  const shown = useCountUp(from, flow, still);
  const [open, setOpen] = useState(true);
  const [now] = useState(() => Date.now());

  const topic = promptById(s.promptId)?.text;
  // Only what really happened: today's talk, and what tomorrow holds. Reopened later, the date.
  const strip = stripText({ stopId: undefined, flow, early, short, at: s.at, now });
  // "34 s" never breaks across lines: a no-break space between the number and the s.
  const finding = mainFinding(s).replace(/(\d) s\b/g, '$1\u00a0s');
  const variety = weeklyVariety(all, s.at);

  const [lo, hi] = PACE_BANDS.talking;
  const zone = paceZone(m.wpm, 'talking');
  const chips = fillerChips(s);
  const meant = s.overruled?.length ?? 0;
  const top = topRepeated(s);
  const first = firstWordSeconds(s);
  const firstUsual = usual.trend?.firstWord?.median;
  const pausesNote = m.longPauses
    ? `${m.longPauses} long ${m.longPauses === 1 ? 'pause' : 'pauses'}, longest ${m.longestPauseSeconds} s`
    : `of ${limit}, no long pauses`;

  const tiles: { label: string; value: string; unit?: string; note: string; tone: string; serif?: boolean }[] = [
    // Shown, not scored: on-device recognisers drop many um/uh, so the number runs low.
    { label: 'Fillers (um, uh)', value: `${m.umCount}`, note: 'Phones miss some.', tone: colors.muted },
    top
      ? { label: 'Repeated words', value: top.word, unit: `×${top.count}`, note: 'Your most used word', tone: colors.muted, serif: true }
      : { label: 'Repeated words', value: 'None', note: 'No word stood out', tone: colors.muted },
    // Whole seconds by the same rule as "You stopped at N s" (wholeSeconds), so the two agree.
    { label: 'Kept going', value: `${wholeSeconds(m.talkSeconds)}`, unit: 's', note: pausesNote, tone: colors.muted },
    first === undefined
      ? { label: 'First word', value: '–', note: 'The first 8 s are free', tone: colors.muted }
      : {
          label: 'First word',
          value: `${first}`,
          unit: 's',
          note: firstUsual !== undefined ? `Your usual: ${Math.round(firstUsual * 10) / 10} s` : 'The first 8 s are free',
          tone: colors.muted,
        },
    {
      label: 'Pace',
      value: `${m.wpm}`,
      unit: 'wpm',
      note: zone === 'good' ? `In the ${lo}–${hi} range` : zone === 'fast' ? `Above ${hi}` : `Below ${lo}`,
      tone: zone === 'good' ? colors.good : colors.ember,
    },
  ];

  return (
    <>
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: colors.muted }]} numberOfLines={1}>
          {limit === 30 ? 'YOUR FIRST TALK' : 'TOPIC TALK'}
          {topic ? (
            <Text style={[styles.topic, { color: colors.ink }]}>
              {' · '}
              {topic}
            </Text>
          ) : null}
        </Text>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={colors.muted} />
        </Pressable>
      </View>

      <View style={styles.scoreRow} accessible accessibilityLabel={`Flow ${flow} out of 100.${under ? ` ${under.text.replace('↑', 'up')}` : ''}`}>
        <Text style={[styles.score, { color: colors.ink }]}>{shown}</Text>
        <View style={styles.scoreSide}>
          <Text style={[styles.flowWord, { color: colors.ink }]}>Flow</Text>
          {under && <Text style={[styles.usual, { color: under.good ? colors.good : colors.muted }]}>{under.text}</Text>}
        </View>
      </View>
      <Text style={[styles.fine, { color: colors.ink }]}>{FLOW_FINE_PRINT}</Text>

      {/* The one most useful finding, with the Drop next to the words, never next to the number. */}
      <Animated.View entering={still ? undefined : FadeIn.delay(FINDING_AT_MS).duration(300)} style={styles.finding}>
        <Drop height={56} pose={early ? 'rest' : 'happy'} nodAt={NOD_AT_MS} />
        <Text style={[styles.findingText, { color: colors.ink }]}>
          {early && <Text style={{ fontWeight: '700' }}>A good start. </Text>}
          {finding}
        </Text>
      </Animated.View>

      <View style={styles.strip} accessible accessibilityLabel={strip.next ? `${strip.done}. ${strip.next}.` : `${strip.done}.`}>
        <Text style={[styles.stripDone, { color: colors.ink }]}>{strip.done}</Text>
        {!!strip.next && <Text style={[styles.stripNext, { color: colors.muted }]}>{strip.next}</Text>}
      </View>

      {/* What to do next, right now: one action tied to this talk. */}
      <PressScale onPress={next.action === 'point' ? onPoint : onAgain} label={`${next.label}. ${next.detail}`} style={[styles.primary, { backgroundColor: colors.button }]}>
        <Text style={styles.primaryText}>{next.label}</Text>
      </PressScale>
      <Text style={[styles.nextDetail, { color: colors.muted }]}>{next.detail}</Text>
      <PressScale onPress={onBack} label="Done" style={styles.again}>
        <Text style={[styles.againText, { color: colors.muted }]}>Done</Text>
      </PressScale>

      {/* The details: calm, below the fold, folds away. */}
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'The details, shown. Tap to hide.' : 'The details, hidden. Tap to show.'}
        style={[styles.detailsHead, { borderTopColor: colors.line }]}
      >
        <Text style={[styles.detailsTitle, { color: colors.ink }]}>The details</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
      </Pressable>

      {open && (
        <>
          {variety !== undefined && (
            <Animated.View
              entering={still ? undefined : FadeIn.duration(260)}
              style={[styles.wide, { backgroundColor: colors.surface, borderColor: colors.line }]}
              accessible
              accessibilityLabel={varietyText(variety)}
            >
              <Text style={[styles.tileLabel, { color: colors.muted }]}>Different words this week</Text>
              <Text style={[styles.tileValue, { color: colors.ink }]}>
                about {variety}
                <Text style={[styles.tileUnit, { color: colors.muted }]}> in every 50</Text>
              </Text>
              <Text style={[styles.tileNote, { color: colors.muted }]}>From your talks over the last 7 days. Compare it only with yourself.</Text>
            </Animated.View>
          )}
          <View style={styles.grid}>
            {tiles.map((t, k) => (
              <Animated.View
                key={t.label}
                entering={still ? undefined : FadeIn.delay(k * TILE_STAGGER_MS).duration(260)}
                style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.line }]}
              >
                <Text style={[styles.tileLabel, { color: colors.muted }]}>{t.label}</Text>
                <Text style={[t.serif ? styles.tileWord : styles.tileValue, { color: colors.ink }]} numberOfLines={1}>
                  {t.value}
                  {t.unit ? <Text style={[styles.tileUnit, { color: colors.muted }]}> {t.unit}</Text> : null}
                </Text>
                <Text style={[styles.tileNote, { color: t.tone }]}>{t.note}</Text>
              </Animated.View>
            ))}
          </View>
          <Text style={[styles.fine, { color: colors.muted }]}>
            Suggested pace for talking: {lo}–{hi} wpm. It’s a guide, not a rule.
          </Text>

          {/* Likely fillers: shown, not scored (FLOW_SCORED). A tap is "I meant that". */}
          {m.habitFillers.length > 0 && (
            <View style={styles.fillers}>
              {chips.length > 0 ? (
                <>
                  <Text style={[styles.fillerText, { color: colors.ink }]}>
                    Likely fillers: {chips.map((c) => `${c.word} ×${c.count}`).join(', ')}. Tap any you meant.
                  </Text>
                  <View style={styles.chips}>
                    {chips.map((c) => (
                      <Pressable
                        key={c.word}
                        onPress={() => onMeant(c.next, c.word)}
                        hitSlop={4}
                        accessibilityRole="button"
                        accessibilityLabel={`${c.word}, ${c.count} ${c.count === 1 ? 'time' : 'times'}. I meant that.`}
                        style={({ pressed }) => [styles.chip, { borderColor: colors.line, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}
                      >
                        <Text style={[styles.chipText, { color: colors.ink }]}>
                          {c.word} <Text style={{ color: colors.muted, fontWeight: '700' }}>×{c.count}</Text>
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={[styles.fillerText, { color: colors.ink }]}>You meant every word we flagged.</Text>
              )}
              {meant > 0 && chips.length > 0 && <Text style={[styles.fine, { color: colors.muted }]}>You marked {meant} as meant.</Text>}
            </View>
          )}
          {m.habitUnsure > 0 && (
            <Text style={[styles.fine, { color: colors.muted }]}>
              {m.habitUnsure === 1
                ? 'One more habit word was hard to judge, so it isn’t counted.'
                : `${m.habitUnsure} more habit words were hard to judge, so they aren’t counted.`}
            </Text>
          )}
        </>
      )}
    </>
  );
}

/**
 * The line strip: stops done (filled, with a check), the track drawing on to the next stop, and the
 * Drop hopping onto it. The line's own colour (sharp or clear), the one place results use it.
 * Under Reduce Motion: drawn already, the Drop already there.
 */
const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(1) },
  eyebrow: { fontSize: 13, fontWeight: '800', letterSpacing: 1.2, flexShrink: 1 },
  topic: { fontFamily: fonts.readingBold, fontSize: 18, letterSpacing: 0 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(1) },
  score: { fontFamily: fonts.display, fontSize: 96, lineHeight: 104, fontVariant: ['tabular-nums'] },
  scoreSide: { flexShrink: 1, gap: 2, paddingTop: space(1) },
  flowWord: { fontFamily: fonts.displayBold, fontSize: 26, lineHeight: 30 },
  usual: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  fine: { fontSize: 14, lineHeight: 20 },
  finding: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), paddingVertical: space(0.5) },
  findingText: { flex: 1, fontSize: 19, lineHeight: 27, fontWeight: '500' },
  strip: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space(1), paddingVertical: space(0.5) },
  stripDone: { fontSize: 16, fontWeight: '800' },
  stripNext: { fontSize: 15, fontWeight: '500' },
  primary: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  nextDetail: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  again: { alignItems: 'center', padding: space(1) },
  againText: { fontSize: 16, fontWeight: '600' },
  detailsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: space(2), marginTop: space(1), minHeight: 44 },
  detailsTitle: { fontSize: 17, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) },
  tile: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: space(1.75), gap: 2 },
  // Full width in the scroll column: no flexBasis here (in a column it would set the height).
  wide: { borderWidth: 1, borderRadius: 14, padding: space(1.75), gap: 2 },
  tileLabel: { fontSize: 13, fontWeight: '600' },
  tileValue: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tileWord: { fontFamily: fonts.readingBold, fontSize: 26, lineHeight: 36 },
  tileUnit: { fontSize: 14, fontWeight: '400', fontFamily: undefined },
  tileNote: { fontSize: 13, lineHeight: 18 },
  fillers: { gap: space(1) },
  fillerText: { fontSize: 15, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1) },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, minHeight: 40, justifyContent: 'center' },
  chipText: { fontSize: 15 },
});
