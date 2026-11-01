import { useCallback, useEffect, useState } from 'react';
import { AppState, BackHandler, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useProfile } from '../../store/profile';
import { listenLocale, onDeviceSupported } from '../../speech/useListener';
import { MINUTE_PROMPTS } from '../../content/prompts';
import { track } from '../../analytics';
import { BRAND } from '../../brand';
import {
  dashIndex,
  FIRST_TALK,
  firstTalkRoute,
  Line,
  LINE_CARDS,
  lineButtonLabel,
  lineOrDefault,
  ONBOARDING_DASHES,
  OnboardingStep,
  parseStep,
  previousStep,
  privacyLine,
} from '../../onboarding';
import { PrimaryButton } from '../../components/ui';
import { Colors, fonts, space, useColors } from '../../theme';

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
  const params = useLocalSearchParams<{ step?: string }>();
  const { profile, update } = useProfile();
  const [step, setStep] = useState<OnboardingStep>(() => parseStep(params.step));
  // Sharp Talk for everyone until they choose; never guessed from the phone's language.
  const [line, setLine] = useState<Line>(() => lineOrDefault(profile.line));
  // Off until they choose: recordings are kept only with an explicit yes.
  const [keep, setKeep] = useState(false);
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

  const back = previousStep(step);
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
    await update({ line });
    setStep('talk');
  };

  const startTalking = async () => {
    if (busy) return;
    setBusy(true);
    await update({ keepRecordings: keep });
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
    router.push(firstTalkRoute());
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
          <View style={styles.center}>
            <HookArt reduceMotion={reduceMotion} />
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
              <Text style={[styles.lead, { color: colors.muted }]}>Talk for one minute a day. Get a little sharper every week.</Text>
            </View>
          </View>
          <View style={styles.foot}>
            <PrimaryButton label="Get started" onPress={() => setStep('line')} />
            <Text style={[styles.small, { color: colors.muted }]}>No account needed.</Text>
          </View>
        </>
      )}

      {step === 'line' && (
        <>
          {/* Scrolls above the pinned button on small screens and large text. */}
          <ScrollView style={styles.flex} contentContainerStyle={styles.body}>
            <Animated.View key="line" entering={enter} style={styles.bodyInner}>
              <View style={styles.titleRow}>
                <Text style={[styles.h1, styles.flex, { color: colors.ink }]} accessibilityRole="header">
                  Which train are you getting on?
                </Text>
                <Drop height={72} look="down" tilt={-10} blink={!reduceMotion} />
              </View>
              <Text style={[styles.lead, { color: colors.muted }]}>Both lines practise the same thing: talking clearly. You can switch any time.</Text>
              <View style={styles.cards} accessibilityRole="radiogroup">
                {LINE_CARDS.map((c, i) => (
                  <LineCardView key={c.id} card={c} index={i} selected={line === c.id} onPress={() => setLine(c.id)} colors={colors} />
                ))}
              </View>
            </Animated.View>
          </ScrollView>
          <View style={styles.foot}>
            <PrimaryButton label={lineButtonLabel(line)} onPress={getOn} />
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
              <View style={[styles.box, styles.keep, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                <View style={styles.flex}>
                  <Text style={[styles.keepTitle, { color: colors.ink }]}>Keep a recording of this talk</Text>
                  <Text style={[styles.keepSub, { color: colors.muted }]}>Off unless you turn it on. Saved on this phone.</Text>
                </View>
                <Switch value={keep} onValueChange={setKeep} accessibilityLabel="Keep a recording of this talk on this phone" />
              </View>
            </Animated.View>
          </ScrollView>
          <View style={styles.foot}>
            {/* One plain line before the system dialog, so it isn't a surprise. */}
            <Text style={[styles.small, { color: colors.muted }]}>Your phone will ask to use the microphone.</Text>
            <PrimaryButton label="Start talking" onPress={startTalking} busy={busy} />
          </View>
        </>
      )}

      {step === 'denied' && (
        <>
          <Animated.View key="denied" entering={enter} style={[styles.center, styles.deniedBody]}>
            <Drop height={120} look="up" blink={!reduceMotion} />
            <Text style={[styles.h1, styles.centerText, { color: colors.ink }]} accessibilityRole="header">
              {BRAND.name} can’t hear you yet
            </Text>
            <Text style={[styles.lead, styles.centerText, { color: colors.muted }]}>
              It needs the microphone to hear your talk. Turn on Microphone and Speech Recognition in Settings.
            </Text>
            <Text style={[styles.note, styles.centerText, { color: colors.muted }]}>Your line is saved. You can do your first talk later from Home.</Text>
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

// The Drop's eyes stay white in both modes, like the text on `button` (PrimaryButton).
const DROP_EYE = '#FFFFFF';
const DROP_PATH = 'M0,-78 C22,-46 52,-18 52,18 A52,52 0 0 1 -52,18 C-52,-18 -22,-46 0,-78 Z';
// Drawn in a 112 × 156 box with the origin at (56, 82) (docs/design/remodel/src/gen.py).
const VIEW_W = 112;
const VIEW_H = 156;
const EYE_SHIFT: Record<'rest' | 'up' | 'down', [number, number]> = { rest: [0, 0], up: [2, -9], down: [-3, 6] };

/**
 * The Drop: flat, cobalt, two white eyes, no mouth, no shine, never sad (docs/design/ANIMATION.md).
 * A static stand-in for the Rive Drop (remodel step 6). Blinks every few seconds when `blink` is on;
 * callers pass `!reduceMotion`. 'happy' swaps the eyes for two small arcs.
 */
export function Drop({
  height,
  look = 'rest',
  tilt = 0,
  blink = false,
}: {
  height: number;
  look?: 'rest' | 'up' | 'down' | 'happy';
  tilt?: number;
  blink?: boolean;
}) {
  const colors = useColors();
  const scale = height / VIEW_H;
  const width = VIEW_W * scale;
  const open = useSharedValue(1);

  useEffect(() => {
    if (!blink || look === 'happy') {
      open.value = 1;
      return;
    }
    // A quick close and open, then a few seconds' rest. Under 160 ms, so it reads as a blink.
    open.value = withRepeat(
      withSequence(withDelay(2800, withTiming(0.1, { duration: 70 })), withTiming(1, { duration: 90 })),
      -1,
    );
  }, [blink, look, open]);

  const eyesStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: open.value }] }));
  const [dx, dy] = look === 'happy' ? [0, 0] : EYE_SHIFT[look];
  // An eye: 11 × 22, rounded, at x -20 and 9, y 4 (plus where it's looking).
  const eye = (x: number) => ({
    position: 'absolute' as const,
    left: (x + dx + 56) * scale,
    top: (4 + dy + 82) * scale,
    width: 11 * scale,
    height: 22 * scale,
    borderRadius: 5.5 * scale,
    backgroundColor: DROP_EYE,
  });

  return (
    <View
      style={{ width, height, transform: tilt ? [{ rotate: `${tilt}deg` }] : undefined }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={height} viewBox={`-56 -82 ${VIEW_W} ${VIEW_H}`}>
        <Path d={DROP_PATH} fill={colors.button} />
        {look === 'happy' && (
          <>
            <Path d="M-23,14 q7.5,-11 15,0" stroke={DROP_EYE} strokeWidth={6} fill="none" strokeLinecap="round" />
            <Path d="M8,14 q7.5,-11 15,0" stroke={DROP_EYE} strokeWidth={6} fill="none" strokeLinecap="round" />
          </>
        )}
      </Svg>
      {look !== 'happy' && (
        <Animated.View style={[StyleSheet.absoluteFill, eyesStyle, { transformOrigin: `50% ${((4 + dy + 82 + 11) / VIEW_H) * 100}%` }]}>
          <View style={eye(-20)} />
          <View style={eye(9)} />
        </Animated.View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- the hook's picture

const ART_H = 230;
const STATION_Y = 168;

/**
 * The Drop standing on the station where the two lines meet: Sharp Talk runs off the left edge,
 * Clear English off the right. The lines draw out from the station (400 ms, after 200 ms), then the
 * Drop blinks. Reduce Motion: everything drawn, no blink.
 */
function HookArt({ reduceMotion }: { reduceMotion: boolean }) {
  const colors = useColors();
  const { width: screenW } = useWindowDimensions();
  const half = screenW / 2;
  const drawn = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      drawn.value = 1;
      return;
    }
    drawn.value = withDelay(200, withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }));
  }, [reduceMotion, drawn]);

  // Each half is revealed from the station outwards by widening a clipping box.
  const reveal = useAnimatedStyle(() => ({ width: drawn.value * half }));
  const y = STATION_Y;
  // Left half, drawn in its own box (x 0..half), from the station down and out to the left edge.
  const leftPath = `M${half},${y} C${half - 30},${y + 44} ${half * 0.45},${y + 38} -12,${y + 52}`;
  const rightPath = `M0,${y} C30,${y + 44} ${half * 0.55},${y + 38} ${half + 12},${y + 52}`;

  return (
    <View style={[styles.art, { height: ART_H }]} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.clip, { right: half }, reveal]}>
        <Svg width={half} height={ART_H} style={styles.clipLeftSvg}>
          <Path d={leftPath} stroke={colors.sharp} strokeWidth={11} fill="none" strokeLinecap="round" />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.clip, { left: half }, reveal]}>
        <Svg width={half} height={ART_H} style={styles.clipRightSvg}>
          <Path d={rightPath} stroke={colors.clear} strokeWidth={11} fill="none" strokeLinecap="round" />
        </Svg>
      </Animated.View>
      <Svg width={screenW} height={ART_H} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={half} cy={y} r={17} fill={colors.surface} stroke={colors.ink} strokeWidth={6} />
      </Svg>
      <View style={[styles.artDrop, { top: y - 17 - 132, left: half - (132 * VIEW_W) / VIEW_H / 2 }]}>
        <Drop height={132} blink={!reduceMotion} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- a "which train?" card

function LineCardView({
  card,
  index,
  selected,
  onPress,
  colors,
}: {
  card: (typeof LINE_CARDS)[number];
  index: number;
  selected: boolean;
  onPress: () => void;
  colors: Colors;
}) {
  const lineColour = card.id === 'sharp' ? colors.sharp : colors.clear;
  const tint = card.id === 'sharp' ? colors.sharpSoft : colors.clearSoft;
  const fill = selected ? tint : colors.surface;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={`${card.name}. ${card.who}`}
      accessibilityHint={`${index + 1} of ${LINE_CARDS.length}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: fill, borderColor: selected ? lineColour : colors.line, transform: [{ scale: pressed ? 0.985 : 1 }] },
      ]}
    >
      {/* The line itself down the left edge: one stop reached, two ahead. Decoration; the name says which line. */}
      <View style={styles.rail}>
        <View style={[styles.railBar, { backgroundColor: lineColour }]} />
        <View style={[styles.stop, { top: 30, backgroundColor: lineColour, borderColor: lineColour }]} />
        <View style={[styles.stop, { top: 74, backgroundColor: fill, borderColor: lineColour }]} />
        <View style={[styles.stop, { top: 118, backgroundColor: fill, borderColor: lineColour }]} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardHead}>
          <Text style={[styles.cardName, { color: colors.ink }]}>{card.name}</Text>
          {/* Selected has a border, a tint and a filled check: never colour alone. */}
          {selected ? (
            <View style={[styles.check, { backgroundColor: lineColour }]}>
              <Ionicons name="checkmark" size={18} color={colors.onLine} />
            </View>
          ) : (
            <View style={[styles.check, styles.checkOff, { borderColor: colors.unread }]} />
          )}
        </View>
        <Text style={[styles.cardWho, { color: colors.ink }]}>{card.who}</Text>
        <View style={styles.practise}>
          {card.practise.map((p) => (
            // ink on the tint: muted on the soft tints is under 4.5:1.
            <Text key={p} style={[styles.practiseText, { color: selected ? colors.ink : colors.muted }]}>
              {p}
            </Text>
          ))}
        </View>
      </View>
    </Pressable>
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
  keep: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  keepTitle: { fontSize: 16, fontWeight: '700' },
  keepSub: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  // Hook picture: full bleed, so the lines run off both edges of the screen.
  art: { marginHorizontal: -space(3) },
  clip: { position: 'absolute', top: 0, height: ART_H, overflow: 'hidden' },
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
