import { Component, useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Drop } from './Drop';
import type { CoachProps } from './coachState';

// Loading is guarded: an older development build may not contain Nitro/Rive yet.
const NativeCoach: ComponentType<CoachProps> | undefined = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native module must fail to the SVG fallback
    return require('./RiveCoach.native').RiveCoach;
  } catch { return undefined; }
})();

class CoachBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function Coach({ height = 44, state = 'idle' }: CoachProps) {
  const [reduced, setReduced] = useState(true);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => setActive(next === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    let mounted = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      changed = true;
      setReduced(value);
    });
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted && !changed) setReduced(value);
    }).catch(() => { /* If unavailable, stay still. */ });
    return () => { mounted = false; subscription.remove(); };
  }, []);
  const fallback = <Drop height={height} pose={state === 'thinking' ? 'up' : 'rest'} alive={false} />;
  const animate = !reduced && active && focused;
  return (
    <View style={{ width: height * 112 / 156, height }} pointerEvents="none"
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {animate && NativeCoach ? <CoachBoundary fallback={fallback}><NativeCoach height={height} state={state} /></CoachBoundary> : fallback}
    </View>
  );
}
