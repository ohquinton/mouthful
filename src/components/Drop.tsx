import { useEffect } from 'react';
import { AppState } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useColors } from '../theme';

export type DropProps = { size?: number; mood?: 'rest' | 'happy' | 'listening'; animated?: boolean };

/** A little breathing room and a glance, never a judgement of someone's speech. */
export function Drop({ size = 72, mood = 'rest', animated = true }: DropProps) {
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(0);
  useEffect(() => {
    const run = (active: boolean) => {
      cancelAnimation(breath);
      breath.set(active && animated && !reduceMotion
        ? withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true)
        : 0);
    };
    run(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => run(state === 'active'));
    return () => { subscription.remove(); cancelAnimation(breath); };
  }, [animated, reduceMotion, breath]);
  const motion = useAnimatedStyle(() => ({
    transform: [{ translateY: -2 * breath.value }, { rotate: `${breath.value * 2 - 1}deg` }],
  }));
  return (
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ width: size, height: size }, motion]}>
      <Svg width={size} height={size} viewBox="0 0 80 80">
        <Path d="M40 3C32 17 13 34 13 51C13 67 24 77 40 77C56 77 67 67 67 51C67 34 48 17 40 3Z" fill={colors.button} />
        {mood === 'happy' ? (
          <>
            <Path d="M27 53Q31 47 35 53M45 53Q49 47 53 53" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" />
          </>
        ) : (
          <>
            <Rect x={mood === 'listening' ? 29 : 27} y={mood === 'listening' ? 45 : 48} width={6} height={11} rx={3} fill="white" />
            <Rect x={mood === 'listening' ? 47 : 45} y={mood === 'listening' ? 45 : 48} width={6} height={11} rx={3} fill="white" />
          </>
        )}
      </Svg>
    </Animated.View>
  );
}
