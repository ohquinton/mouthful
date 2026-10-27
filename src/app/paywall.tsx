import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TARGET_WPM } from '../engine/score';
import { PlanId, PLANS, purchase, PurchaseCancelled, PurchasesNotConfigured, restore, storePrices } from '../purchases';
import { track } from '../analytics';
import { BRAND } from '../brand';
import { useProfile } from '../store/profile';
import { getSession } from '../store/sessions';
import { ProFeature, UPSELL } from '../pro';
import { PrimaryButton } from '../components/ui';
import { fonts, space, useColors } from '../theme';

const BENEFITS: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }[] = [
  { icon: 'document-text-outline', text: 'Rehearse your real answer, talk or pitch' },
  { icon: 'pulse-outline', text: 'Drill the exact words you trip on' },
  { icon: 'play-circle-outline', text: 'Hear your Day 1 next to Day 30' },
];

export default function Paywall() {
  const { feature, wpm: wpmParam } = useLocalSearchParams<{ feature?: ProFeature; wpm?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, update } = useProfile();
  const [plan, setPlan] = useState<PlanId>('annual');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [day1, setDay1] = useState<number | undefined>(wpmParam ? Number(wpmParam) : undefined);
  const [prices, setPrices] = useState<Partial<Record<PlanId, string>>>({});

  useEffect(() => {
    update({ paywallSeen: true });
    track('paywall_view', { feature: feature ?? 'main', has_day1: !!day1 });
    storePrices().then((p) => p && setPrices(p));
    if (!day1 && profile.baselineSessionId) getSession(profile.baselineSessionId).then((s) => s && setDay1(s.wpm));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const upsell = feature ? UPSELL[feature] : undefined;
  // The headline uses their real number. That one line out-converts any feature list.
  const target = TARGET_WPM[1] - 15;
  const headline = upsell
    ? upsell.title
    : day1 && day1 > TARGET_WPM[1]
      ? `Your Day 1 is ${day1} wpm. Let’s get you to ${target}.`
      : day1
        ? `Your Day 1 is ${day1} wpm. Let’s make every word land.`
        : 'Be ready when it counts.';

  const buy = async () => {
    setBusy(true);
    setError(null);
    track('purchase_attempt', { plan, feature: feature ?? 'main' });
    try {
      const r = await purchase(plan);
      track('purchase_result', { plan, pro: r.pro });
      if (r.pro) {
        await update({ pro: true });
        close();
      }
    } catch (e) {
      if (e instanceof PurchaseCancelled) return;
      track('purchase_result', { plan, pro: false, error: e instanceof PurchasesNotConfigured ? 'not_configured' : 'failed' });
      setError(e instanceof PurchasesNotConfigured ? e.message : 'The purchase didn’t go through. You haven’t been charged.');
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    try {
      const r = await restore();
      if (r.pro) {
        await update({ pro: true });
        close();
      } else setError('No previous purchase found on this Apple ID.');
    } catch (e) {
      setError(e instanceof PurchasesNotConfigured ? e.message : 'Restore failed. Try again.');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + space(1), paddingBottom: insets.bottom + space(2) }]}>
      <Pressable onPress={close} hitSlop={12} style={styles.close} accessibilityLabel="Not now">
        <Ionicons name="close" size={26} color={colors.muted} />
      </Pressable>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.eyebrow, { color: colors.signal }]}>{BRAND.name.toUpperCase()} PRO</Text>
        <Text style={[styles.h1, { color: colors.ink }]}>{headline}</Text>
        {upsell && <Text style={[styles.lead, { color: colors.muted }]}>{upsell.line}</Text>}

        <View style={styles.benefits}>
          {BENEFITS.map((b) => (
            <View key={b.text} style={styles.benefit}>
              <Ionicons name={b.icon} size={22} color={colors.signal} />
              <Text style={[styles.benefitText, { color: colors.ink }]}>{b.text}</Text>
            </View>
          ))}
        </View>

        {(['annual', 'monthly'] as PlanId[]).map((id) => {
          const p = PLANS[id];
          const on = plan === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => setPlan(id)}
              style={[styles.plan, { borderColor: on ? colors.signal : colors.line, backgroundColor: colors.surface, borderWidth: on ? 2 : 1 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.planTitle, { color: colors.ink }]}>{id === 'annual' ? 'Annual' : 'Monthly'}</Text>
                <Text style={[styles.planNote, { color: id === 'annual' ? colors.good : colors.muted }]}>{p.note}</Text>
              </View>
              <Text style={[styles.planPrice, { color: colors.ink }]}>
                {prices[id] ?? p.price}
                <Text style={[styles.planPer, { color: colors.muted }]}> /{p.period === 'year' ? 'yr' : 'mo'}</Text>
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {error && <Text style={[styles.error, { color: colors.stumble }]}>{error}</Text>}
      <PrimaryButton label={plan === 'annual' ? 'Start free trial' : 'Subscribe'} busy={busy} onPress={buy} />
      <Text style={[styles.fine, { color: colors.muted }]}>
        {plan === 'annual'
          ? `Free for 7 days, then ${prices.annual ?? PLANS.annual.price} a year. Cancel anytime in Settings before the trial ends.`
          : `${prices.monthly ?? PLANS.monthly.price} a month. Cancel anytime in Settings.`}
      </Text>
      <View style={styles.footer}>
        <Pressable onPress={close} hitSlop={8}>
          <Text style={[styles.footerLink, { color: colors.ink }]}>Not now</Text>
        </Pressable>
        <Pressable onPress={onRestore} hitSlop={8}>
          <Text style={[styles.footerLink, { color: colors.muted }]}>Restore purchases</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space(3), gap: space(1.25) },
  close: { alignSelf: 'flex-end', padding: space(1) },
  content: { gap: space(2), paddingBottom: space(2) },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  h1: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 36 },
  lead: { fontSize: 17, lineHeight: 24 },
  benefits: { gap: space(1.5), marginVertical: space(1) },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  benefitText: { fontSize: 17, flex: 1 },
  plan: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: space(2), minHeight: 72 },
  planTitle: { fontSize: 17, fontWeight: '700' },
  planNote: { fontSize: 14, marginTop: 2 },
  planPrice: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  planPer: { fontSize: 14, fontWeight: '500' },
  error: { fontSize: 14, textAlign: 'center' },
  fine: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space(1) },
  footerLink: { fontSize: 15, fontWeight: '600', paddingVertical: 8 },
});
