import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Literata_500Medium, Literata_700Bold } from '@expo-google-fonts/literata';
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { ProfileProvider, useProfile } from '../store/profile';
import { customerState, initPurchases, onCustomerChange, type CustomerState } from '../purchases';
import { syncTrialReminder } from '../reminders';
import { useColors } from '../theme';
import { wrapRoot } from '../sentry';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayout() {
  const colors = useColors();
  const [loaded, failed] = useFonts({
    Literata_500Medium,
    Literata_700Bold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });

  useEffect(() => {
    if (loaded || failed) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, failed]);

  if (!loaded && !failed) return null;

  return (
    <ProfileProvider>
      <EntitlementSync />
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding/index" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="onboarding/day1" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="session/[id]" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="talk" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="tape" options={{ animation: 'fade' }} />
        <Stack.Screen name="fixit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen name="scripts/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pack/[id]" />
        <Stack.Screen name="words" />
        <Stack.Screen name="moment" options={{ presentation: 'modal' }} />
        <Stack.Screen name="review" />
      </Stack>
    </ProfileProvider>
  );
}

// Reports render errors as crash reports, once the profile provider has started Sentry
// (it waits for the reader's choice). Before that, or with sharing off, it does nothing.
export default wrapRoot(RootLayout);

/**
 * On launch, the store is the source of truth for Pro (when purchases are configured). It also
 * keeps the trial reminder honest: scheduled while a trial will turn into a charge, cancelled
 * once they cancel it in Settings, whether we find out at launch or while the app is open.
 */
function EntitlementSync() {
  const { ready, profile, update } = useProfile();
  // The latest value, for the store listener below, which outlives this render.
  const pro = useRef(profile.pro);
  useEffect(() => {
    pro.current = profile.pro;
  }, [profile.pro]);

  useEffect(() => {
    if (!ready) return;
    const apply = async (state: NonNullable<CustomerState>) => {
      if (state.pro !== pro.current) await update({ pro: state.pro });
      await syncTrialReminder(state.trial, { ask: false });
    };
    (async () => {
      await initPurchases();
      const state = await customerState();
      if (state) await apply(state);
    })();
    return onCustomerChange((state) => {
      apply(state);
    });
  }, [ready, update]);
  return null;
}
