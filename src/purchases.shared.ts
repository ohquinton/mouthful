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
