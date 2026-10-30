export type PlanId = 'annual' | 'monthly';

/** Fallback copy if the store prices haven't loaded. Real prices come from RevenueCat (local currency). */
export const PLANS: Record<PlanId, { id: PlanId; price: string; period: string; note: string }> = {
  // The free trial is only mentioned when the store says this person can get it (trialOffer()).
  annual: { id: 'annual', price: '$39.99', period: 'year', note: 'Billed once a year' },
  monthly: { id: 'monthly', price: '$6.99', period: 'month', note: 'Cancel anytime' },
};

export const ENTITLEMENT = 'pro';

/** A free trial the store has confirmed this person can start, or null (no trial copy). */
export type TrialOffer = { days: number } | null;

/**
 * A free trial the reader is in right now, from the store: when it ends and whether it will turn
 * into a charge (false once they cancel in Settings). null = not in a trial (paid, or no Pro).
 */
export type TrialStatus = { endsAt: number; willRenew: boolean } | null;

/** What a purchase or restore tells us. `trial` is undefined when the store couldn't say. */
export type PurchaseResult = { pro: boolean; trial?: TrialStatus };

/** The store's view of this reader on launch, or null when it couldn't be checked. */
export type CustomerState = { pro: boolean; trial: TrialStatus } | null;

export class PurchasesNotConfigured extends Error {
  constructor() {
    super('Purchases are not set up in this build yet.');
  }
}

export class PurchaseCancelled extends Error {
  constructor() {
    super('Purchase cancelled.');
  }
}
