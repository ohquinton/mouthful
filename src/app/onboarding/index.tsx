import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MomentId, MOMENTS } from '../../content/moments';
import { useProfile } from '../../store/profile';
import { listenLocale, onDeviceSupported } from '../../speech/useListener';
import { track } from '../../analytics';
import { BRAND } from '../../brand';
import { PrimaryButton } from '../../components/ui';
import { fonts, space, useColors } from '../../theme';

const HOOK = BRAND.tagline.split(' ');

type Step = 'hook' | 'moment' | 'mic';
type Choice = MomentId | 'everyday';

export default function Onboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, update } = useProfile();
  const [step, setStep] = useState<Step>('hook');
  const [choice, setChoice] = useState<Choice | undefined>((profile.moment?.id as MomentId) ?? undefined);
  // Off until they choose: recordings are kept only with an explicit yes.
  const [keep, setKeep] = useState(false);
  const [inked, setInked] = useState(0);
  const offline = onDeviceSupported(listenLocale(profile.speechLang));

  // The hook demonstrates Glide on its own: words ink in at a calm reading pace.
  useEffect(() => {
    if (step !== 'hook') return;
    const t = setInterval(() => setInked((n) => (n >= HOOK.length + 6 ? 0 : n + 1)), 380);
    return () => clearInterval(t);
  }, [step]);

  useEffect(() => {
    track('onboarding_step', { step });
  }, [step]);

  const dots = (
    <View style={styles.dots}>
      {(['hook', 'moment', 'mic'] as Step[]).map((s) => (
        <View key={s} style={[styles.dot, { backgroundColor: s === step ? colors.signal : colors.line }]} />
      ))}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + space(3), paddingBottom: insets.bottom + space(2) }]}>
      {dots}

      {step === 'hook' && (
        <>
          <View style={styles.center}>
            <Text style={[styles.brand, { color: colors.signal }]}>{BRAND.name}</Text>
            <Text style={styles.hookText}>
              {HOOK.map((w, i) => (
                <Text key={i} style={{ color: i < inked ? colors.ink : colors.unread, backgroundColor: i === inked ? colors.signalSoft : 'transparent' }}>
                  {w}{' '}
                </Text>
              ))}
            </Text>
            <Text style={[styles.lead, { color: colors.muted }]}>
              {BRAND.promise} {BRAND.name} follows along as you read and shows you the words that trip you up.
            </Text>
          </View>
          <PrimaryButton label="Get started" onPress={() => setStep('moment')} />
        </>
      )}

      {step === 'moment' && (
        <>
          <Animated.View entering={FadeInDown.duration(260)} style={styles.body}>
            <Text style={[styles.h1, { color: colors.ink }]}>What are you preparing for?</Text>
            <View style={styles.tiles}>
              {[...MOMENTS.map((m) => ({ id: m.id as Choice, title: m.title, sub: m.sub, icon: m.icon as string })), { id: 'everyday' as Choice, title: 'Everyday speaking', sub: 'Build the habit, a few minutes a day', icon: 'sunny-outline' }].map((m) => {
                const on = choice === m.id;
                return (
                  <Pressable
                    key={m.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    onPress={() => setChoice(m.id)}
                    style={[styles.tile, { borderColor: on ? colors.signal : colors.line, backgroundColor: on ? colors.signalSoft : colors.surface }]}
                  >
                    <Ionicons name={m.icon as 'sunny-outline'} size={22} color={colors.signal} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.tileTitle, { color: colors.ink }]}>{m.title}</Text>
                      <Text style={[styles.tileSub, { color: colors.muted }]}>{m.sub}</Text>
                    </View>
                    <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? colors.signal : colors.line} />
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
          <PrimaryButton
            label="Continue"
            disabled={!choice}
            onPress={async () => {
              await update({ moment: choice && choice !== 'everyday' ? { id: choice, startedAt: Date.now(), done: [] } : null });
              track('moment_start', { moment: choice ?? null, from: 'onboarding' });
              setStep('mic');
            }}
          />
        </>
      )}

      {step === 'mic' && (
        <>
          <Animated.View entering={FadeInDown.duration(260)} style={styles.center}>
            <View style={[styles.micCircle, { backgroundColor: colors.signalSoft }]}>
              <Ionicons name="mic" size={40} color={colors.signal} />
            </View>
            <Text style={[styles.h1, { color: colors.ink, textAlign: 'center' }]}>First, a 30-second read</Text>
            <Text style={[styles.lead, { color: colors.muted, textAlign: 'center' }]}>
              This is your Day 1. Read at your normal pace. {BRAND.name} listens only while you read.{' '}
              {offline
                ? 'Your speech is turned into text on this phone.'
                : 'If this device can’t turn speech into text offline, we’ll ask before using a speech service.'}
            </Text>
            <View style={[styles.keep, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.keepTitle, { color: colors.ink }]}>Keep my Day 1 recording</Text>
                <Text style={[styles.keepSub, { color: colors.muted }]}>
                  Off unless you turn it on. Kept on this phone, and in its backup if you use one, so you can hear the difference on day 7 and day 30. Delete it any time in You.
                </Text>
              </View>
              <Switch value={keep} onValueChange={setKeep} accessibilityLabel="Keep my Day 1 recording on this phone" />
            </View>
          </Animated.View>
          <PrimaryButton
            label="Start my Day 1 read"
            onPress={async () => {
              await update({ keepRecordings: keep });
              router.push({ pathname: '/session/[id]', params: { id: 'baseline' } });
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space(3), gap: space(3) },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: { width: 24, height: 4, borderRadius: 2 },
  center: { flex: 1, justifyContent: 'center', gap: space(2.5) },
  body: { flex: 1, gap: space(2.5), paddingTop: space(2) },
  brand: { fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.3 },
  hookText: { fontFamily: fonts.readingBold, fontSize: 34, lineHeight: 48 },
  h1: { fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 34 },
  lead: { fontSize: 17, lineHeight: 25 },
  tiles: { gap: space(1) },
  tile: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), borderWidth: 1.5, borderRadius: 18, padding: space(1.75), minHeight: 64 },
  tileTitle: { fontSize: 16, fontWeight: '600' },
  tileSub: { fontSize: 13, marginTop: 2 },
  micCircle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  keep: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), borderWidth: 1, borderRadius: 16, padding: space(2) },
  keepTitle: { fontSize: 16, fontWeight: '600' },
  keepSub: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
