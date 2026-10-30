// Web and test build. The phone build uses purchases.native.ts (RevenueCat).
// Development unlocks Pro locally so gated screens can be tested; production refuses.
import { CustomerState, PlanId, PurchaseResult, PurchasesNotConfigured, TrialOffer } from './purchases.shared';

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

/** No store here: unknown, so the profile and any reminder stay as they are. */
export async function customerState(): Promise<CustomerState> {
  return null;
}

/** No store, so nothing ever changes underneath us. Returns the unsubscribe. */
export function onCustomerChange(_cb: (state: NonNullable<CustomerState>) => void): () => void {
  return () => {};
}

// No `trial` in dev: there's no store to start one, so no trial reminder gets scheduled.
export async function purchase(_plan: PlanId): Promise<PurchaseResult> {
  if (__DEV__) return { pro: true };
  throw new PurchasesNotConfigured();
}

export async function restore(): Promise<PurchaseResult> {
  if (__DEV__) return { pro: false };
  throw new PurchasesNotConfigured();
}
