import { useCallback, useEffect, useState } from 'react';
import { AppState, BackHandler, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useProfile } from '../../store/profile';
import { useExperience } from '../../store/experience';
import { listenLocale, onDeviceSupported } from '../../speech/useListener';
import { MINUTE_PROMPTS } from '../../content/prompts';
import { track } from '../../analytics';
import { BRAND } from '../../brand';
import {
  dashIndex,
  FIRST_TALK,
  firstTalkRoute,
  Line,
  ONBOARDING_DASHES,
  OnboardingStep,
  parseStep,
  previousStep,
  privacyLine,
} from '../../onboarding';
import { PrimaryButton } from '../../components/ui';
import { Drop } from '../../components/Drop';
import { fonts, space, useColors } from '../../theme';

const HOOK = BRAND.tagline.split(' ');
const TOPIC = MINUTE_PROMPTS.find((p) => p.id === FIRST_TALK.promptId)?.text ?? 'Coffee';

// Brief: docs/briefs/remodel-screens.md section 1. Hook → which train? → first topic talk on one
// route; the back arrow and Android back walk between them. talk.tsx runs the 30-second talk and
// replaces itself with the starting point (onboarding/day1.tsx). `?step=` opens a given step
// (talk.tsx can send a refused mic back to `?step=denied`); anything unknown opens the hook.
export default function Onboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const params = useLocalSearchParams<{ step?: string; reminderCleanup?: string }>();
  const { profile, update } = useProfile();
  const { mode, showChoices } = useExperience();
  const [step, setStep] = useState<OnboardingStep>(() => params.step === 'line' ? 'hook' : parseStep(params.step));
  // The launch choice sets the first-practice context; never infer it from language.
  const line: Line = mode === 'english' ? 'clear' : 'sharp';
  // No recording switch here: topic talks don't record, and keepRecordings (reading re-tests) is
  // only ever changed in You, where it says what it's for.
  const [busy, setBusy] = useState(false);
  const [inked, setInked] = useState(0);
  const onDevice = onDeviceSupported(listenLocale(profile.speechLang));

  // The hook shows Glide on its own: the tagline inks in at a calm reading pace. Still under Reduce Motion.
  useEffect(() => {
    if (step !== 'hook' || reduceMotion) return;
    const t = setInterval(() => setInked((n) => (n >= HOOK.length + 6 ? 0 : n + 1)), 380);
    return () => clearInterval(t);
  }, [step, reduceMotion]);

  useEffect(() => {
    track('onboarding_step', { step });
  }, [step]);

  // Back from Settings with the microphone now on: straight back to the talk intro.
  useEffect(() => {
    if (step !== 'denied') return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      ExpoSpeechRecognitionModule.getPermissionsAsync()
        .then((p) => p.granted && setStep('talk'))
        .catch(() => {});
    });
    return () => sub.remove();
  }, [step]);

  const back = step === 'talk' ? 'hook' : previousStep(step);
  const goBack = useCallback(() => {
    if (back) setStep(back);
  }, [back]);

  // Android back goes to the previous step, not out of the app. Only while this screen is focused,
  // so the back button still works normally on the talk screen pushed on top of it.
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

  const getOn = async () => {
    // The line choice isn't sent to analytics: "Clear English" is a self-described second-language
    // speaker, close to the locale rule (DECISIONS 2026-10-27). Only that the step was passed.
    if (!profile.onboarded) await update({ line });
    setStep('talk');
  };

  const startTalking = async () => {
    if (busy) return;
    setBusy(true);
    // Ask here, right under "Your phone will ask to use the microphone", so a "no" lands on our own
    // screen with a way out. Only the permission: nothing listens until talk.tsx starts, after
    // MicGate has had its say about speech services. Web always says yes.
    let granted = true;
    try {
      granted = (await ExpoSpeechRecognitionModule.requestPermissionsAsync()).granted;
    } catch {
      // Couldn't ask (old build, odd platform): talk.tsx asks again and MicGate handles a "no".
    }
    setBusy(false);
    if (!granted) {
      track('mic_denied', { where: 'onboarding' });
      setStep('denied');
      return;
    }
    router.push(firstTalkRoute(line));
  };

  // A "no" to the mic must never trap anyone (principle 8): finish onboarding and open Home, where
  // the first talk waits as stop 1. The line is already saved.
  const skip = async () => {
    await update({ onboarded: true });
    track('onboarding_complete', { skipped: true, reason: 'denied' });
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
  };

  // Each step fades in; nothing moves under Reduce Motion.
  const enter = reduceMotion ? undefined : FadeInDown.duration(260);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + space(1), paddingBottom: insets.bottom + space(2) }]}>
      <TopBar onBack={back ? goBack : undefined} active={dashIndex(step)} />

      {step === 'hook' && (
        <>
          <ScrollView style={styles.flex} contentContainerStyle={styles.hookScroll}>
            {params.reminderCleanup === 'failed' && (
              <Text accessibilityLiveRegion="polite" style={[styles.small, { color: colors.ink }]}>
                A reminder could not be cleared. You can turn off SaidClearly notifications in your phone’s Settings.
              </Text>
            )}
            <View style={{ alignItems: 'center' }}><Drop height={100} /></View>
            <View style={styles.hookWords}>
              <Text style={[styles.brand, { color: colors.ink }]}>{BRAND.name}</Text>
              <Text style={styles.hookText} accessibilityLabel={BRAND.tagline}>
                {HOOK.map((w, i) => {
                  const done = reduceMotion || i < inked;
                  return (
                    <Text key={i} style={{ color: done ? colors.ink : colors.unread, backgroundColor: !reduceMotion && i === inked ? colors.signalSoft : 'transparent' }}>
                      {w}{' '}
                    </Text>
                  );
                })}
              </Text>
              <Text style={[styles.lead, { color: colors.muted }]}>{mode === 'english' ? 'Practise everyday English, read aloud, and build useful vocabulary.' : 'Practise expressing your ideas, notice speaking habits, and build precise vocabulary.'}</Text>
            </View>
          </ScrollView>
          <View style={styles.foot}>
            <PrimaryButton label="Try a short talk" onPress={getOn} />
            <Pressable accessibilityRole="button" onPress={showChoices} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[styles.small, { color: colors.ink }]}>Choose a different experience</Text></Pressable>
            <Text style={[styles.small, { color: colors.muted }]}>No account needed.</Text>
          </View>
        </>
      )}

      {step === 'talk' && (
        <>
          <ScrollView style={styles.flex} contentContainerStyle={styles.body}>
            <Animated.View key="talk" entering={enter} style={styles.bodyInner}>
              <Text style={[styles.eyebrow, { color: colors.muted }]}>YOUR FIRST TOPIC TALK · {FIRST_TALK.seconds} SECONDS</Text>
              <Text style={[styles.topic, { color: colors.ink }]} accessibilityRole="header">
                {TOPIC}
              </Text>
              <Text style={[styles.lead, { color: colors.ink }]}>Talk about it for {FIRST_TALK.seconds} seconds. Anything you like is fine.</Text>
              <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                <Text style={[styles.boxTitle, { color: colors.ink }]}>If you’re not sure where to start</Text>
                {FIRST_TALK.ideas.map((idea) => (
                  <Text key={idea} style={[styles.idea, { color: colors.muted }]}>
                    {idea}
                  </Text>
                ))}
              </View>
              <View style={styles.privacy}>
                <Ionicons name="phone-portrait-outline" size={18} color={colors.muted} style={styles.privacyIcon} />
                <Text style={[styles.privacyText, { color: colors.muted }]}>{privacyLine(onDevice)}</Text>
              </View>
            </Animated.View>
          </ScrollView>
          <View style={styles.foot}>
            {/* One plain line before the system dialog, so it isn't a surprise. */}
            <Text style={[styles.small, { color: colors.muted }]}>Your phone will ask to use the microphone.</Text>
            <PrimaryButton label="Continue" onPress={startTalking} busy={busy} />
          </View>
        </>
      )}

      {step === 'denied' && (
        <>
          <Animated.View key="denied" entering={enter} style={[styles.center, styles.deniedBody]}>
            <Drop height={120} pose="up" />
            <Text style={[styles.h1, styles.centerText, { color: colors.ink }]} accessibilityRole="header">
              {BRAND.name} can’t hear you yet
            </Text>
            <Text style={[styles.lead, styles.centerText, { color: colors.muted }]}>
              It needs the microphone to hear your talk. Turn on Microphone and Speech Recognition in Settings.
            </Text>
            <Text style={[styles.note, styles.centerText, { color: colors.muted }]}>Your choice is saved. You can do your first talk later from Home.</Text>
          </Animated.View>
          <View style={styles.foot}>
            <PrimaryButton label="Open Settings" onPress={openSettings} />
            <Pressable onPress={skip} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.link, { color: colors.muted }]}>Skip for now</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

/** Settings can't open on web (and may throw on some platforms): fail quietly. */
function openSettings() {
  try {
    Linking.openSettings().catch(() => {});
  } catch {}
}

// ---------------------------------------------------------------- pieces shared with day1.tsx

/** Back arrow (when there is a step to go back to) and the four progress dashes. */
export function TopBar({ onBack, active }: { onBack?: () => void; active: number }) {
  const colors = useColors();
  return (
    <View style={styles.top}>
      <View style={styles.topSide}>
        {onBack && (
          <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color={colors.ink} />
          </Pressable>
        )}
      </View>
      <View style={styles.dots} accessibilityLabel={`Step ${active + 1} of ${ONBOARDING_DASHES}`}>
        {Array.from({ length: ONBOARDING_DASHES }, (_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i === active ? colors.ink : colors.line }]} />
        ))}
      </View>
      <View style={styles.topSide} />
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
  hookScroll: { flexGrow: 1, justifyContent: 'center', gap: space(2.5), paddingBottom: space(2) },
  centerText: { textAlign: 'center' },
  deniedBody: { alignItems: 'center', gap: space(2) },
  hookWords: { gap: space(2) },
  body: { paddingTop: space(1), paddingBottom: space(2) },
  bodyInner: { gap: space(2) },
  foot: { gap: space(1.5), alignItems: 'stretch' },
  brand: { fontFamily: fonts.display, fontSize: 24, letterSpacing: -0.3 },
  hookText: { fontFamily: fonts.readingBold, fontSize: 34, lineHeight: 48 },
  h1: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  lead: { fontSize: 17, lineHeight: 25 },
  small: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  note: { fontSize: 14, lineHeight: 20 },
  link: { fontSize: 16, fontWeight: '600', textAlign: 'center', padding: space(1) },
  eyebrow: { fontSize: 13, fontWeight: '800', letterSpacing: 1.3, marginTop: space(2) },
  topic: { fontFamily: fonts.readingBold, fontSize: 56, lineHeight: 66, marginTop: -space(0.5) },
  box: { borderWidth: 1, borderRadius: 18, padding: space(2), gap: space(0.75) },
  boxTitle: { fontSize: 16, fontWeight: '700', marginBottom: space(0.25) },
  idea: { fontSize: 17, lineHeight: 24 },
  privacy: { flexDirection: 'row', gap: space(1.25) },
  privacyIcon: { marginTop: 2 },
  privacyText: { flex: 1, fontSize: 15, lineHeight: 21 },
  // Hook picture: full bleed, so the lines run off both edges of the screen.
  art: { marginHorizontal: -space(3) },
  clip: { position: 'absolute', top: 0, height: 230, overflow: 'hidden' },
  clipLeftSvg: { position: 'absolute', top: 0, right: 0 },
  clipRightSvg: { position: 'absolute', top: 0, left: 0 },
  artDrop: { position: 'absolute' },
  cards: { gap: space(1.5) },
  card: { flexDirection: 'row', borderWidth: 2, borderRadius: 22, overflow: 'hidden', minHeight: 160 },
  rail: { width: 52 },
  railBar: { position: 'absolute', left: 21, top: 0, bottom: 0, width: 10 },
  stop: { position: 'absolute', left: 14, width: 24, height: 24, borderRadius: 12, borderWidth: 5 },
  cardBody: { flex: 1, paddingVertical: space(2), paddingRight: space(2), paddingLeft: space(0.5), gap: space(0.75) },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(1) },
  cardName: { fontFamily: fonts.display, fontSize: 24, letterSpacing: -0.3 },
  check: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  checkOff: { borderWidth: 2 },
  cardWho: { fontSize: 16, lineHeight: 22 },
  practise: { gap: 3, marginTop: space(0.5) },
  practiseText: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
});
