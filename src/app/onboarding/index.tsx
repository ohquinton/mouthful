import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { countdownLabel, getMoment, MomentId, MOMENTS } from '../../content/moments';
import { useProfile } from '../../store/profile';
import { listenLocale, onDeviceSupported } from '../../speech/useListener';
import { track } from '../../analytics';
import { BRAND } from '../../brand';
import { momentDate, OnboardingStep, previousStep, WHEN_CHIPS } from '../../onboarding';
import { PrimaryButton } from '../../components/ui';
import { fonts, space, useColors } from '../../theme';

const HOOK = BRAND.tagline.split(' ');
const STEPS: OnboardingStep[] = ['hook', 'moment', 'mic'];

// Brief: docs/briefs/onboarding-redesign.md. Three steps on one route; the back arrow and Android
// back walk between them. The starting point (after the first read) is onboarding/day1.tsx.
export default function Onboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { profile, update } = useProfile();
  const [step, setStep] = useState<OnboardingStep>('hook');
  const [choice, setChoice] = useState<MomentId | undefined>(getMoment(profile.moment?.id)?.id);
  // No chip chosen until they tap one: the date is theirs to say, "Not sure" included.
  const [when, setWhen] = useState<number | null | undefined>(undefined);
  // Off until they choose: recordings are kept only with an explicit yes.
  const [keep, setKeep] = useState(false);
  const [inked, setInked] = useState(0);
  const offline = onDeviceSupported(listenLocale(profile.speechLang));

  // The hook shows Glide on its own: the tagline inks in at a calm reading pace. Still under Reduce Motion.
  useEffect(() => {
    if (step !== 'hook' || reduceMotion) return;
    const t = setInterval(() => setInked((n) => (n >= HOOK.length + 6 ? 0 : n + 1)), 380);
    return () => clearInterval(t);
  }, [step, reduceMotion]);

  useEffect(() => {
    track('onboarding_step', { step });
  }, [step]);

  const back = previousStep(step);
  const goBack = useCallback(() => {
    if (back) setStep(back);
  }, [back]);

  // Android back goes to the previous step, not out of the app. Only while this screen is focused,
  // so the back button still works normally in the reading session pushed on top of it.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!back) return false;
        setStep(back);
        return true;
      });
      return () => sub.remove();
    }, [back]),
  );

  const makePlan = async () => {
    if (!choice || when === undefined) return;
    await update({ moment: { id: choice, date: momentDate(when), startedAt: Date.now(), done: [] } });
    track('moment_start', { moment: choice, days_out: when ?? -1, from: 'onboarding' });
    setStep('mic');
  };

  const justPractise = async () => {
    await update({ moment: null });
    setChoice(undefined);
    track('moment_start', { moment: null, from: 'onboarding' });
    setStep('mic');
  };

  const moment = getMoment(profile.moment?.id);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + space(1), paddingBottom: insets.bottom + space(2) }]}>
      <View style={styles.top}>
        <View style={styles.topSide}>
          {back && (
            <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={26} color={colors.ink} />
            </Pressable>
          )}
        </View>
        <View style={styles.dots}>
          {STEPS.map((s) => (
            <View key={s} style={[styles.dot, { backgroundColor: s === step ? colors.ink : colors.line }]} />
          ))}
        </View>
        <View style={styles.topSide} />
      </View>

      {step === 'hook' && (
        <>
          <View style={styles.center}>
            <Text style={[styles.brand, { color: colors.ink }]}>{BRAND.name}</Text>
            <Text style={styles.hookText}>
              {HOOK.map((w, i) => {
                const done = reduceMotion || i < inked;
                return (
                  <Text key={i} style={{ color: done ? colors.ink : colors.unread, backgroundColor: !reduceMotion && i === inked ? colors.signalSoft : 'transparent' }}>
                    {w}{' '}
                  </Text>
                );
              })}
            </Text>
            <Text style={[styles.lead, { color: colors.muted }]}>
              Learn the words you need, then say them out loud. They ink in as you say them.
            </Text>
          </View>
          <View style={styles.foot}>
            <PrimaryButton label="Get started" onPress={() => setStep('moment')} />
            <Text style={[styles.small, { color: colors.muted }]}>No account needed.</Text>
          </View>
        </>
      )}

      {step === 'moment' && (
        <>
          {/* Scrolls above the pinned button on small screens and large text. */}
          <ScrollView style={styles.flex} contentContainerStyle={styles.body}>
            <Animated.View entering={FadeInDown.duration(260)} style={styles.bodyInner}>
              <Text style={[styles.h1, { color: colors.ink }]}>What are you preparing for?</Text>
              <View style={styles.tiles}>
                {MOMENTS.map((m) => {
                  const on = choice === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      onPress={() => setChoice(m.id)}
                      style={[styles.tile, { borderColor: on ? colors.signal : colors.line, backgroundColor: on ? colors.signalSoft : colors.surface }]}
                    >
                      <Ionicons name={m.icon} size={22} color={colors.signal} />
                      <View style={styles.flex}>
                        <Text style={[styles.tileTitle, { color: colors.ink }]}>{m.title}</Text>
                        <Text style={[styles.tileSub, { color: colors.muted }]}>{m.sub}</Text>
                      </View>
                      <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? colors.signal : colors.line} />
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.h2, { color: colors.ink }]}>When is it?</Text>
              <View style={styles.chips}>
                {WHEN_CHIPS.map((w) => {
                  const on = when === w.days;
                  return (
                    <Pressable
                      key={w.label}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      onPress={() => setWhen(w.days)}
                      style={[styles.chip, { borderColor: on ? colors.signal : colors.line, backgroundColor: on ? colors.signalSoft : colors.surface }]}
                    >
                      <Text style={[styles.chipText, { color: colors.ink }]}>{w.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          </ScrollView>
          <View style={styles.foot}>
            <PrimaryButton label="Make my plan" disabled={!choice || when === undefined} onPress={makePlan} />
            <Pressable onPress={justPractise} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.link, { color: colors.muted }]}>Nothing planned? Just practise</Text>
            </Pressable>
          </View>
        </>
      )}

      {step === 'mic' && (
        <>
          <ScrollView style={styles.flex} contentContainerStyle={styles.body}>
            <Animated.View entering={FadeInDown.duration(260)} style={styles.bodyInner}>
              {moment && profile.moment && (
                <View style={[styles.planCard, { backgroundColor: colors.card }]}>
                  <Text style={[styles.planEyebrow, { color: colors.cardMuted }]}>{moment.title.toUpperCase()} PLAN</Text>
                  <Text style={[styles.planTitle, { color: colors.cardInk }]}>{countdownLabel(moment, profile.moment.date)}</Text>
                  <Text style={[styles.planSub, { color: colors.cardMuted }]}>5 short steps. The first one takes 30 seconds.</Text>
                </View>
              )}
              <Text style={[styles.h1, styles.micTitle, { color: colors.ink }]}>First, a 30-second read</Text>
              <Text style={[styles.lead, { color: colors.muted }]}>
                Read a short passage out loud at your normal pace. This is your starting point.
              </Text>
              <View style={styles.privacy}>
                <Ionicons name="phone-portrait-outline" size={16} color={colors.muted} style={styles.privacyIcon} />
                <Text style={[styles.privacyText, { color: colors.muted }]}>
                  {offline
                    ? 'It listens only while you read. Your speech is turned into text on this phone.'
                    : 'It listens only while you read, and asks before using a speech service.'}
                </Text>
              </View>
              <View style={[styles.keep, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                <View style={styles.flex}>
                  <Text style={[styles.keepTitle, { color: colors.ink }]}>Keep a recording of this read</Text>
                  <Text style={[styles.keepSub, { color: colors.muted }]}>Off unless you turn it on. Saved on this phone (and its backup).</Text>
                </View>
                <Switch value={keep} onValueChange={setKeep} accessibilityLabel="Keep a recording of this read on this phone" />
              </View>
            </Animated.View>
          </ScrollView>
          <View style={styles.foot}>
            {/* One plain line before the system dialog, so it isn't a surprise. */}
            <Text style={[styles.small, { color: colors.muted }]}>Your phone will ask to use the microphone.</Text>
            <PrimaryButton
              label="Start reading"
              onPress={async () => {
                await update({ keepRecordings: keep });
                router.push({ pathname: '/session/[id]', params: { id: 'baseline' } });
              }}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space(3), gap: space(2) },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', height: 44 },
  topSide: { width: 44, justifyContent: 'center' },
  dots: { flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: { width: 24, height: 4, borderRadius: 2 },
  center: { flex: 1, justifyContent: 'center', gap: space(2.5) },
  body: { paddingTop: space(1), paddingBottom: space(2) },
  bodyInner: { gap: space(2) },
  foot: { gap: space(1.5), alignItems: 'stretch' },
  brand: { fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.3 },
  hookText: { fontFamily: fonts.readingBold, fontSize: 34, lineHeight: 48 },
  h1: { fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 34 },
  micTitle: { marginTop: space(2) },
  h2: { fontSize: 18, fontWeight: '700', marginTop: space(1) },
  lead: { fontSize: 17, lineHeight: 25 },
  small: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  link: { fontSize: 15, fontWeight: '600', textAlign: 'center', padding: space(0.5) },
  tiles: { gap: space(1) },
  tile: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), borderWidth: 1.5, borderRadius: 18, padding: space(1.75), minHeight: 64 },
  tileTitle: { fontSize: 16, fontWeight: '600' },
  tileSub: { fontSize: 13, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1) },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: space(1.75), paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  chipText: { fontSize: 15, fontWeight: '500' },
  planCard: { borderRadius: 20, padding: space(2.5), gap: space(0.75) },
  planEyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.1 },
  planTitle: { fontFamily: fonts.readingBold, fontSize: 24, lineHeight: 30 },
  planSub: { fontSize: 14, lineHeight: 20 },
  privacy: { flexDirection: 'row', gap: space(1) },
  privacyIcon: { marginTop: 2 },
  privacyText: { flex: 1, fontSize: 14, lineHeight: 20 },
  keep: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), borderWidth: 1, borderRadius: 16, padding: space(2) },
  keepTitle: { fontSize: 16, fontWeight: '600' },
  keepSub: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
