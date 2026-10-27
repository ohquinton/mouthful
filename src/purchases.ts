// Web and test build. The phone build uses purchases.native.ts (RevenueCat).
// Development unlocks Pro locally so gated screens can be tested; production refuses.
import { PlanId, PurchasesNotConfigured, TrialOffer } from './purchases.shared';

export * from './purchases.shared';

export async function initPurchases(): Promise<boolean> {
  return false;
}

export async function storePrices(): Promise<Partial<Record<PlanId, string>> | null> {
  return null;
}

/** No store here, so no trial can be confirmed: the paywall shows the plain price. */
export async function trialOffer(_plan: PlanId): Promise<TrialOffer> {
  return null;
}

export async function hasPro(): Promise<boolean | null> {
  return null; // unknown: keep whatever the profile says
}

export async function purchase(_plan: PlanId): Promise<{ pro: boolean }> {
  if (__DEV__) return { pro: true };
  throw new PurchasesNotConfigured();
}

export async function restore(): Promise<{ pro: boolean }> {
  if (__DEV__) return { pro: false };
  throw new PurchasesNotConfigured();
}
