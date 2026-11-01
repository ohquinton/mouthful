import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { useColors } from '../theme';

// The Drop (DECISIONS 2026-10-30, docs/briefs/remodel-screens.md §0.3): a flat ink drop in the
// `button` cobalt, two white capsule eyes, no mouth, no shine, never sad. The one Drop in the app:
// onboarding, the home map, the talk footer and the results all use this. It's the static-SVG
// version; the Rive coach replaces it later behind the same props, with this one as the fallback.
// Geometry matches the mockups (docs/design/remodel/src/gen.py, viewBox -56 -82 112 156).

const VIEW_W = 112;
const VIEW_H = 156;
const BODY = 'M0,-78 C22,-46 52,-18 52,18 A52,52 0 0 1 -52,18 C-52,-18 -22,-46 0,-78 Z';
// Eyes stay white in both modes: they sit on the cobalt body, never on the page.
const EYE = '#fff';

/**
 * - rest: eyes open, looking ahead.
 * - happy: the eyes become two small arcs (a stop done, a talk that kept going).
 * - up / down: looking up at the topic (talk footer, mic denied) or down at the cards.
 */
export type DropPose = 'rest' | 'happy' | 'up' | 'down';
/** @deprecated the home map's old name for the pose. */
export type DropMood = DropPose;

/** Where the eyes look, in viewBox units. */
const LOOK: Record<Exclude<DropPose, 'happy'>, [number, number]> = { rest: [0, 0], up: [2, -9], down: [-3, 6] };

export type DropProps = {
  /** Height in points; the width follows the drop's shape (about 0.72 × the height). */
  height?: number;
  pose?: DropPose;
  /** The slow breath and the ~6 s blink. Off under Reduce Motion whatever this says. */
  alive?: boolean;
  /** A small nod, once, this many ms after mount (results). Nothing under Reduce Motion. */
  nodAt?: number;
  /** A fixed lean in degrees (onboarding's "which train?" Drop looks down at the cards). */
  tilt?: number;
};

/** Hidden from screen readers: it's decoration, the words beside it say everything. */
export function Drop({ height = 72, pose = 'rest', alive = true, nodAt, tilt = 0 }: DropProps) {
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  const width = (height * VIEW_W) / VIEW_H;
  const k = height / VIEW_H; // points per viewBox unit
  const move = alive && !reduceMotion;

  // Breathing: a slow 2% swell from the bottom, so it looks like it's standing, not floating.
  const breath = useSharedValue(0);
  // Blink: eyes squash shut for ~100 ms about every six seconds.
  const blink = useSharedValue(1);
  // Nod: tip forward a few degrees and dip a little, then back.
  const nod = useSharedValue(0);

  useEffect(() => {
    if (!move) {
      cancelAnimation(breath);
      cancelAnimation(blink);
      breath.value = 0;
      blink.value = 1;
      return;
    }
    breath.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
    blink.value = withRepeat(
      withSequence(withDelay(4600, withTiming(0.12, { duration: 70 })), withTiming(1, { duration: 110 }), withDelay(1400, withTiming(1, { duration: 0 }))),
      -1,
    );
    return () => {
      cancelAnimation(breath);
      cancelAnimation(blink);
    };
  }, [move, breath, blink]);

  useEffect(() => {
    if (reduceMotion || nodAt === undefined) return;
    const ease = { duration: 160, easing: Easing.inOut(Easing.quad) };
    nod.value = withDelay(nodAt, withSequence(withTiming(1, ease), withTiming(0, ease)));
  }, [reduceMotion, nodAt, nod]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: nod.value * 3 },
      { rotate: `${tilt + nod.value * 8}deg` },
      { scaleY: 1 + breath.value * 0.025 },
      { scaleX: 1 - breath.value * 0.012 },
    ],
  }));
  const eyeStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));

  // Eye capsules from the mockup: x -20 and 9, y 4, 11 × 22, fully rounded, plus where they look.
  const [lx, ly] = pose === 'happy' ? [0, 0] : LOOK[pose];
  const eye = (x: number) => ({
    left: (x + lx + 56) * k,
    top: (4 + ly + 82) * k,
    width: 11 * k,
    height: 22 * k,
    borderRadius: 5.5 * k,
  });

  return (
    <Animated.View
      style={[{ width, height, transformOrigin: 'bottom' }, bodyStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Svg width={width} height={height} viewBox="-56 -82 112 156">
        <Path d={BODY} fill={colors.button} />
        {pose === 'happy' && (
          <>
            <Path d="M-23,14 q7.5,-11 15,0" stroke={EYE} strokeWidth={6} fill="none" strokeLinecap="round" />
            <Path d="M8,14 q7.5,-11 15,0" stroke={EYE} strokeWidth={6} fill="none" strokeLinecap="round" />
          </>
        )}
      </Svg>
      {pose !== 'happy' && (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.eye, eye(-20), eyeStyle]} />
          <Animated.View style={[styles.eye, eye(9), eyeStyle]} />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  eye: { position: 'absolute', backgroundColor: EYE },
});
