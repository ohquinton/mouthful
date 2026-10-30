// iOS / Android: real subscriptions through RevenueCat.
//
// Setup (once): create products `mouthful_pro_annual` ($39.99/yr, 7-day free trial as an
// introductory offer, which trialOffer() reads) and
// `mouthful_pro_monthly` ($6.99/mo) in App Store Connect, add them to the RevenueCat
// "default" offering as the Annual and Monthly packages, and attach the "pro" entitlement.
// Then set EXPO_PUBLIC_REVENUECAT_IOS_KEY (and _ANDROID_KEY) in .env.
//
// With no key: development builds unlock Pro locally for testing; production builds refuse.
import { Platform } from 'react-native';
import Purchases, { INTRO_ELIGIBILITY_STATUS, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import {
  CustomerState,
  ENTITLEMENT,
  PlanId,
  PurchaseCancelled,
  PurchaseResult,
  PurchasesNotConfigured,
  TrialOffer,
  TrialStatus,
} from './purchases.shared';

export * from './purchases.shared';

const KEY = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
let configured = false;

const isPro = (info: CustomerInfo) => !!info.entitlements.active[ENTITLEMENT];

/**
 * The free trial the reader is in now, if any. RevenueCat reports a trial as periodType TRIAL,
 * with the trial's end as the expiration date. willRenew turns false once they cancel in Settings.
 */
function trialOf(info: CustomerInfo): TrialStatus {
  const e = info.entitlements.active[ENTITLEMENT];
  if (!e || e.periodType?.toUpperCase() !== 'TRIAL' || !e.expirationDateMillis) return null;
  return { endsAt: e.expirationDateMillis, willRenew: e.willRenew };
}

const stateOf = (info: CustomerInfo): NonNullable<CustomerState> => ({ pro: isPro(info), trial: trialOf(info) });

export async function initPurchases(): Promise<boolean> {
  if (!KEY) return false;
  if (!configured) {
    Purchases.configure({ apiKey: KEY });
    configured = true;
  }
  return true;
}

async function packageFor(plan: PlanId): Promise<PurchasesPackage | null> {
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) return null;
  return plan === 'annual' ? current.annual : current.monthly;
}

/** Localised prices from the store, e.g. "CA$54.99". */
export async function storePrices(): Promise<Partial<Record<PlanId, string>> | null> {
  if (!(await initPurchases())) return null;
  try {
    const [annual, monthly] = await Promise.all([packageFor('annual'), packageFor('monthly')]);
    return { annual: annual?.product.priceString, monthly: monthly?.product.priceString };
  } catch {
    return null;
  }
}

const DAYS_PER: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };
const toDays = (unit: string, count: number) => (DAYS_PER[unit] ?? 0) * count;

/**
 * The free trial this person can actually get on a plan, or null. Apple rejects paywalls that
 * promise a trial to someone who already used it (Guideline 3.1.2), so anything short of a
 * clear yes from the store (unknown, offline, not configured) means no trial copy.
 */
export async function trialOffer(plan: PlanId): Promise<TrialOffer> {
  if (!(await initPurchases())) return null;
  try {
    const pkg = await packageFor(plan);
    if (!pkg) return null;
    const product = pkg.product;
    if (Platform.OS === 'ios') {
      const intro = product.introPrice;
      if (!intro || intro.price !== 0) return null; // no intro, or a discount rather than a free trial
      const result = await Purchases.checkTrialOrIntroductoryPriceEligibility([product.identifier]);
      if (result[product.identifier]?.status !== INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE) return null;
      const days = toDays(intro.periodUnit, intro.periodNumberOfUnits * Math.max(1, intro.cycles));
      return days > 0 ? { days } : null;
    }
    // Android's eligibility check always says "unknown", but Google Play only includes the free
    // phase in the default offer for people who can still get it.
    const free = product.defaultOption?.freePhase;
    if (!free) return null;
    const days = toDays(free.billingPeriod.unit, free.billingPeriod.value * Math.max(1, free.billingCycleCount ?? 1));
    return days > 0 ? { days } : null;
  } catch {
    return null;
  }
}

/** Source of truth for Pro on the phone. null = couldn't check (offline or not configured). */
export async function hasPro(): Promise<boolean | null> {
  if (!(await initPurchases())) return null;
  try {
    return isPro(await Purchases.getCustomerInfo());
  } catch {
    return null;
  }
}

/** Pro and the trial in one store call, for launch. null = couldn't check. */
export async function customerState(): Promise<CustomerState> {
  if (!(await initPurchases())) return null;
  try {
    return stateOf(await Purchases.getCustomerInfo());
  } catch {
    return null;
  }
}

/**
 * Calls back whenever RevenueCat learns something new about this reader while the app is open,
 * e.g. they cancelled the trial in Settings and came back. Returns the unsubscribe.
 */
export function onCustomerChange(cb: (state: NonNullable<CustomerState>) => void): () => void {
  if (!KEY) return () => {};
  const listener = (info: CustomerInfo) => cb(stateOf(info));
  // configure() must run first; initPurchases is synchronous once it has the key.
  initPurchases().then(() => Purchases.addCustomerInfoUpdateListener(listener)).catch(() => {});
  return () => {
    try {
      Purchases.removeCustomerInfoUpdateListener(listener);
    } catch {}
  };
}

export async function purchase(plan: PlanId): Promise<PurchaseResult> {
  if (!(await initPurchases())) {
    if (__DEV__) return { pro: true };
    throw new PurchasesNotConfigured();
  }
  const pkg = await packageFor(plan);
  if (!pkg) throw new PurchasesNotConfigured();
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return stateOf(customerInfo);
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) throw new PurchaseCancelled();
    throw e;
  }
}

export async function restore(): Promise<PurchaseResult> {
  if (!(await initPurchases())) {
    if (__DEV__) return { pro: false };
    throw new PurchasesNotConfigured();
  }
  return stateOf(await Purchases.restorePurchases());
}
