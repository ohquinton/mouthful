// iOS / Android: real subscriptions through RevenueCat.
//
// Setup (once): create products `mouthful_pro_annual` ($39.99/yr, 7-day trial) and
// `mouthful_pro_monthly` ($6.99/mo) in App Store Connect, add them to the RevenueCat
// "default" offering as the Annual and Monthly packages, and attach the "pro" entitlement.
// Then set EXPO_PUBLIC_REVENUECAT_IOS_KEY (and _ANDROID_KEY) in .env.
//
// With no key: development builds unlock Pro locally for testing; production builds refuse.
import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import { ENTITLEMENT, PlanId, PurchaseCancelled, PurchasesNotConfigured } from './purchases.shared';

export * from './purchases.shared';

const KEY = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
let configured = false;

const isPro = (info: CustomerInfo) => !!info.entitlements.active[ENTITLEMENT];

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

/** Source of truth for Pro on the phone. null = couldn't check (offline or not configured). */
export async function hasPro(): Promise<boolean | null> {
  if (!(await initPurchases())) return null;
  try {
    return isPro(await Purchases.getCustomerInfo());
  } catch {
    return null;
  }
}

export async function purchase(plan: PlanId): Promise<{ pro: boolean }> {
  if (!(await initPurchases())) {
    if (__DEV__) return { pro: true };
    throw new PurchasesNotConfigured();
  }
  const pkg = await packageFor(plan);
  if (!pkg) throw new PurchasesNotConfigured();
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { pro: isPro(customerInfo) };
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) throw new PurchaseCancelled();
    throw e;
  }
}

export async function restore(): Promise<{ pro: boolean }> {
  if (!(await initPurchases())) {
    if (__DEV__) return { pro: false };
    throw new PurchasesNotConfigured();
  }
  return { pro: isPro(await Purchases.restorePurchases()) };
}
