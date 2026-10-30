import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TARGET_WPM } from '../engine/score';
import {
  PlanId,
  PLANS,
  purchase,
  PurchaseCancelled,
  PurchasesNotConfigured,
  restore,
  storePrices,
  trialOffer,
  type TrialOffer,
} from '../purchases';
import { track } from '../analytics';
import { billingLine, subscriptionsUrl } from '../billing';
import { syncTrialReminder } from '../reminders';
import { BRAND } from '../brand';
import { useProfile } from '../store/profile';
import { getSession } from '../store/sessions';
import { ahaCopy, paywallFrom, trackPaywallClose, trackPaywallView, upsellFeature, UPSELL } from '../pro';
import { daysUntil, getMoment } from '../content/moments';
import { PrimaryButton } from '../components/ui';
import { fonts, space, useColors } from '../theme';

type Benefit = { icon: React.ComponentProps<typeof Ionicons>['name']; text: string };

const BENEFITS: Benefit[] = [
  { icon: 'document-text-outline', text: 'Rehearse your real answer, talk or pitch' },
  { icon: 'pulse-outline', text: 'Drill the exact words you trip on' },
  { icon: 'play-circle-outline', text: 'Hear your Day 1 next to Day 30' },
];

// After the free script run: what Pro adds to what they just did.
const AHA_BENEFITS: Benefit[] = [
  { icon: 'repeat-outline', text: 'Rehearse every part, as often as you need' },
  { icon: 'documents-outline', text: 'Add every answer you’re preparing' },
  { icon: 'pulse-outline', text: 'Drill the words you trip on' },
];

/** Route params are strings from anywhere (deep links too): only whole, non-negative numbers count. */
function count(v: string | undefined): number | undefined {
  if (!v || !/^\d{1,5}$/.test(v)) return undefined;
  return Number(v);
}

export default function Paywall() {
  const params = useLocalSearchParams<{ feature?: string; from?: string; wpm?: string; words?: string; heard?: string; moment?: string }>();
  // Only features we know: anything else shows the main paywall.
  const feature = upsellFeature(params.feature);
  const from = paywallFrom(params.from, feature);
  // The Tape passes the free run's numbers as it leaves, so "I said it" corrections count.
  const aha =
    from === 'aha' && count(params.wpm) !== undefined && count(params.words) !== undefined && count(params.heard) !== undefined
      ? { wpm: count(params.wpm)!, words: count(params.words)!, heard: count(params.heard)! }
      : undefined;
  const wpmParam = from === 'aha' ? undefined : count(params.wpm);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, update } = useProfile();
  const [plan, setPlan] = useState<PlanId>('annual');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [day1, setDay1] = useState<number | undefined>(wpmParam);
  const [prices, setPrices] = useState<Partial<Record<PlanId, string>>>({});
  // Only the store knows whether this person can still get the free trial. Until it says yes, no trial copy.
  const [trial, setTrial] = useState<TrialOffer>(null);
  // For paywall_close: whether they bought (then leaving isn't a close).
  const bought = useRef(false);

  useEffect(() => {
    // The full paywall after the free run opens once; after that, soft walls only.
    update(from === 'aha' ? { paywallSeen: true, ahaPaywallShown: true } : { paywallSeen: true });
    trackPaywallView(from, feature, !!day1);
    storePrices().then((p) => p && setPrices(p));
    trialOffer('annual').then(setTrial);
    if (from !== 'aha' && !day1 && profile.baselineSessionId) getSession(profile.baselineSessionId).then((s) => s && setDay1(s.wpm));
    const opened = Date.now();
    // On unmount, so a swipe-down counts as well as Not now and the close button.
    return () => {
      if (!bought.current) trackPaywallClose(from, feature, opened);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const upsell = feature ? UPSELL[feature] : undefined;
  // After the free run: their own numbers, never their words. The moment's name only when the
  // Tape said this script is the moment's (params.moment); the days only for that moment's date.
  const moment = params.moment && params.moment === profile.moment?.id ? getMoment(params.moment) : undefined;
  const daysToGo = moment && profile.moment?.date ? daysUntil(profile.moment.date) : undefined;
  const ahaText = aha ? ahaCopy({ ...aha, momentShort: moment?.short, daysToGo }) : undefined;
  const lead = upsell?.line ?? ahaText?.lead;
  const benefits = from === 'aha' ? AHA_BENEFITS : BENEFITS;
  // The headline uses their real number. That one line out-converts any feature list.
  const target = TARGET_WPM[1] - 15;
  const headline = upsell
    ? upsell.title
    : ahaText
      ? ahaText.headline
      : day1 && day1 > TARGET_WPM[1]
      ? `Your Day 1 is ${day1} wpm. Let’s get you to ${target}.`
      : day1
        ? `Your Day 1 is ${day1} wpm. Let’s make every word land.`
        : 'Be ready when it counts.';

  const buy = async () => {
    setBusy(true);
    setError(null);
    track('purchase_attempt', { plan, from, feature: feature ?? 'main' });
    try {
      const r = await purchase(plan);
      track('purchase_result', { plan, from, pro: r.pro, trial: !!r.trial });
      if (r.pro) {
        bought.current = true;
        await update({ pro: true });
        // A trial gets its "ends in 2 days" reminder (asking for notifications now, since they
        // just started it); a paid plan cancels any old one. Unknown (no store): leave it.
        if (r.trial !== undefined) await syncTrialReminder(r.trial, { ask: !!r.trial });
        close();
      }
    } catch (e) {
      if (e instanceof PurchaseCancelled) return;
      track('purchase_result', { plan, from, pro: false, error: e instanceof PurchasesNotConfigured ? 'not_configured' : 'failed' });
      setError(e instanceof PurchasesNotConfigured ? e.message : 'The purchase didn’t go through. You haven’t been charged.');
    } finally {
      setBusy(false);
    }
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => setError(`Couldn’t open the link. It’s ${url}`));
  };

  const onRestore = async () => {
    try {
      const r = await restore();
      if (r.trial !== undefined) await syncTrialReminder(r.trial, { ask: false });
      if (r.pro) {
        bought.current = true;
        await update({ pro: true });
        close();
      } else setError('No earlier purchase found for this account.');
    } catch (e) {
      setError(e instanceof PurchasesNotConfigured ? e.message : 'Couldn’t reach the store. Check your connection and try again.');
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
        {lead && <Text style={[styles.lead, { color: colors.muted }]}>{lead}</Text>}

        <View style={styles.benefits}>
          {benefits.map((b) => (
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
                <Text style={[styles.planNote, { color: id === 'annual' && trial ? colors.good : colors.muted }]}>
                  {id === 'annual' && trial ? `${trial.days}-day free trial` : p.note}
                </Text>
              </View>
              <Text style={[styles.planPrice, { color: colors.ink }]}>
                {prices[id] ?? p.price}
                <Text style={[styles.planPer, { color: colors.muted }]}> /{p.period === 'year' ? 'yr' : 'mo'}</Text>
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Exactly what happens to their money, with the price, before the button that spends it.
          Outside the scroll so it's always next to the button. */}
      <Text style={[styles.billing, { color: colors.ink }]} accessibilityLiveRegion="polite">
        {billingLine({ plan, price: prices[plan] ?? PLANS[plan].price, trialDays: plan === 'annual' ? trial?.days : undefined, os: Platform.OS })}
      </Text>
      <Pressable onPress={() => openLink(subscriptionsUrl(Platform.OS))} hitSlop={8} accessibilityRole="link" style={styles.howTo}>
        <Text style={[styles.legalLink, { color: colors.signal }]}>How to cancel</Text>
      </Pressable>
      {/* Ink, not red: a store hiccup isn't the reader's mistake. */}
      {error && <Text style={[styles.error, { color: colors.ink }]}>{error}</Text>}
      <PrimaryButton label={plan === 'annual' && trial ? 'Start free trial' : 'Subscribe'} busy={busy} onPress={buy} />
      <View style={styles.legal}>
        <Pressable onPress={() => openLink(BRAND.privacyUrl)} hitSlop={8} accessibilityRole="link">
          <Text style={[styles.legalLink, { color: colors.muted }]}>Privacy policy</Text>
        </Pressable>
        <Text style={[styles.legalDot, { color: colors.muted }]}>·</Text>
        <Pressable onPress={() => openLink(BRAND.termsUrl)} hitSlop={8} accessibilityRole="link">
          <Text style={[styles.legalLink, { color: colors.muted }]}>Terms of use</Text>
        </Pressable>
      </View>
      <View style={styles.footer}>
        <Pressable onPress={close} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.footerLink, { color: colors.ink }]}>Not now</Text>
        </Pressable>
        <Pressable onPress={onRestore} hitSlop={8} accessibilityRole="button">
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
  planPrice: { fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  planPer: { fontSize: 14, fontWeight: '500' },
  error: { fontSize: 14, textAlign: 'center' },
  billing: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  howTo: { alignSelf: 'center', marginTop: -space(1) },
  legal: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space(1) },
  // paddingVertical + hitSlop make a tap target of at least 44 pt.
  legalLink: { fontSize: 13, textDecorationLine: 'underline', paddingVertical: 10 },
  legalDot: { fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space(1) },
  footerLink: { fontSize: 15, fontWeight: '600', paddingVertical: 8 },
});
