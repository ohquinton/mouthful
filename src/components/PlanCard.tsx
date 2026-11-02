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
import { space, useColors } from '../theme';
import { ProBadge } from './ui';

/**
 * The active moment's five-step plan, compact: how far along, and a tap for what's next.
 * `sessions` come from Home (it reloads them on focus), for the free run.
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

  const doneCount = steps.filter((s) => done.includes(s.id)).length;
  const sub = next ? (next.id === 'rehearse' && freeRunLeft ? `Next: ${next.title}. ${FREE_RUN_LINE}` : `Next: ${next.title}`) : 'Plan done. One more run-through on the day.';

  // Compact since the remodel: moments are optional destinations, so the plan is one small card
  // under the map. Tapping it opens the next step; "Change" opens the moment picker.
  return (
    <Animated.View entering={FadeIn.duration(250)} layout={LinearTransition}>
      <Pressable
        onPress={() => (next ? go(next) : router.push({ pathname: '/moment', params: { id: m.id } }))}
        accessibilityRole="button"
        accessibilityLabel={`${m.title} plan. ${countdownLabel(m, profile.moment.date)}. ${doneCount} of ${steps.length} steps done. ${sub}`}
        style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.8 : 1 }]}
      >
        <View style={[styles.count, { backgroundColor: colors.signalSoft }]}>
          <Text style={[styles.countText, { color: colors.signal }]}>
            {doneCount}/{steps.length}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.title, { color: colors.ink }]} numberOfLines={2}>
            {countdownLabel(m, profile.moment.date)}
          </Text>
          <View style={styles.subRow}>
            <Text style={[styles.sub, { color: colors.muted }]} numberOfLines={2}>
              {sub}
            </Text>
            {next && locked(next) && <ProBadge />}
          </View>
        </View>
        <Pressable onPress={() => router.push({ pathname: '/moment', params: { id: m.id } })} hitSlop={10} accessibilityRole="button" accessibilityLabel="Change the plan">
          <Text style={[styles.change, { color: colors.muted }]}>Change</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), borderWidth: 1, borderRadius: 18, paddingVertical: space(1.25), paddingHorizontal: space(1.5), minHeight: 56 },
  count: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 13, fontWeight: '700' },
  title: { fontSize: 15, fontWeight: '700' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  sub: { fontSize: 13, lineHeight: 17, flexShrink: 1 },
  change: { fontSize: 13, fontWeight: '600' },
});
