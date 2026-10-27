import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Literata_500Medium, Literata_700Bold } from '@expo-google-fonts/literata';
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { ProfileProvider, useProfile } from '../store/profile';
import { hasPro, initPurchases } from '../purchases';
import { useColors } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
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

/** On launch, the store is the source of truth for Pro (when purchases are configured). */
function EntitlementSync() {
  const { ready, profile, update } = useProfile();
  useEffect(() => {
    if (!ready) return;
    (async () => {
      await initPurchases();
      const pro = await hasPro();
      if (pro !== null && pro !== profile.pro) await update({ pro });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  return null;
}
