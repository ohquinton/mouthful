import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { countdownLabel, FREE_RUN_LINE, getMoment, nextStep, planSteps, PlanStep, StepId } from '../content/moments';
import { getPack, packPassageId } from '../content/wordpacks';
import { scriptChunkId } from '../content/resolve';
import { useProfile } from '../store/profile';
import type { SavedSession } from '../store/sessions';
import { freeRunUsed } from '../pro';
import { fonts, space, useColors } from '../theme';
import { ProBadge } from './ui';

/**
 * The active moment's five-step plan: what's done, and one button for what's next.
 * `sessions` come from Today (it reloads them on focus), for the free run.
 */
export function PlanCard({ sessions }: { sessions: SavedSession[] }) {
  const colors = useColors();
  const { profile } = useProfile();
  const m = getMoment(profile.moment?.id);
  if (!m || !profile.moment) return null;
  const pack = getPack(m.packId)!;
  const steps = planSteps(m);
  const done = (profile.moment.done ?? []) as StepId[];
  const next = nextStep(steps, done);
  const scriptId = profile.moment.scriptId;
  // Free readers get one run of their script's part 1. Until it's used, step 4 says so up front.
  const runUsed = freeRunUsed(sessions);
  const freeRunLeft = !profile.pro && !runUsed;
  const locked = (s: PlanStep) => s.pro && !profile.pro && runUsed;

  // Step 3 always opens scripts/new: it offers a script they've already saved (free, even when
  // their one free script was added from the Scripts tile) and walls only a second new one.
  const addScript = () => router.push({ pathname: '/scripts/new', params: { moment: m.id, step: 'script' } });

  const go = (s: PlanStep) => {
    switch (s.id) {
      case 'learn':
        return router.push({ pathname: '/fixit', params: { words: pack.words.map((w) => w.word).join(','), title: pack.title, step: 'learn' } });
      case 'context':
        return router.push({ pathname: '/session/[id]', params: { id: packPassageId(pack.id, 0), step: 'context', pace: m.pace } });
      case 'script':
        return addScript();
      case 'rehearse':
        if (!scriptId) return addScript();
        // No gate here on purpose: session/[id].tsx checks canRehearse() for every way in.
        return router.push({ pathname: '/session/[id]', params: { id: scriptChunkId(scriptId, 0), step: 'rehearse', pace: m.pace } });
      case 'retest':
        return router.push({ pathname: '/session/[id]', params: { id: packPassageId(pack.id, 1), cold: '1', step: 'retest', pace: m.pace } });
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(250)} layout={LinearTransition} style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: colors.cardMuted }]}>{m.title.toUpperCase()} PLAN</Text>
        <Pressable onPress={() => router.push({ pathname: '/moment', params: { id: m.id } })} hitSlop={8}>
          <Text style={[styles.change, { color: colors.cardMuted }]}>Change</Text>
        </Pressable>
      </View>
      <Text style={[styles.title, { color: colors.cardInk }]}>{countdownLabel(m, profile.moment.date)}</Text>

      <View style={styles.steps}>
        {steps.map((s, i) => {
          const isDone = done.includes(s.id);
          const isNext = next?.id === s.id;
          return (
            <Pressable key={s.id} onPress={() => go(s)} style={styles.step} accessibilityRole="button" accessibilityLabel={`${s.title}${isDone ? ', done' : ''}`}>
              <View
                style={[
                  styles.dot,
                  isDone
                    ? { backgroundColor: colors.good, borderColor: colors.good }
                    : { borderColor: isNext ? colors.cardInk : colors.cardMuted },
                ]}
              >
                {isDone ? <Ionicons name="checkmark" size={14} color={colors.card} /> : <Text style={[styles.num, { color: isNext ? colors.cardInk : colors.cardMuted }]}>{i + 1}</Text>}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.stepTitle, { color: isDone ? colors.cardMuted : colors.cardInk, textDecorationLine: isDone ? 'line-through' : 'none' }]}>
                  {s.title}
                </Text>
                {s.id === 'rehearse' && freeRunLeft ? (
                  <Text style={[styles.stepSub, styles.freeLine, { color: colors.good }]}>{FREE_RUN_LINE}</Text>
                ) : (
                  isNext && <Text style={[styles.stepSub, { color: colors.cardMuted }]} numberOfLines={2}>{s.sub}</Text>
                )}
              </View>
              {locked(s) && !isDone && <ProBadge />}
            </Pressable>
          );
        })}
      </View>

      {next ? (
        <Pressable onPress={() => go(next)} style={({ pressed }) => [styles.btn, { backgroundColor: colors.button, opacity: pressed ? 0.85 : 1 }]}>
          <Ionicons name={next.id === 'learn' ? 'book-outline' : next.id === 'script' ? 'create-outline' : 'mic'} size={18} color="#fff" />
          <Text style={styles.btnText}>{next.title}</Text>
        </Pressable>
      ) : (
        <Text style={[styles.ready, { color: colors.cardInk }]}>Plan done. Do one more run-through on the day, then go say it.</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: space(2.5), gap: space(1.5) },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.1 },
  change: { fontSize: 13, fontWeight: '600' },
  title: { fontFamily: fonts.readingBold, fontSize: 24, lineHeight: 30 },
  steps: { gap: space(1.25), marginTop: space(0.5) },
  step: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), minHeight: 32 },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  num: { fontSize: 13, fontWeight: '700' },
  stepTitle: { fontSize: 16, fontWeight: '600' },
  stepSub: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  freeLine: { fontWeight: '600' },
  btn: { flexDirection: 'row', gap: 8, borderRadius: 16, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: space(0.5) },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  ready: { fontSize: 16, lineHeight: 22 },
});
