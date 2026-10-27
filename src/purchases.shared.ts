export type PlanId = 'annual' | 'monthly';

/** Fallback copy if the store prices haven't loaded. Real prices come from RevenueCat (local currency). */
export const PLANS: Record<PlanId, { id: PlanId; price: string; period: string; note: string }> = {
  annual: { id: 'annual', price: '$39.99', period: 'year', note: '7-day free trial' },
  monthly: { id: 'monthly', price: '$6.99', period: 'month', note: 'Cancel anytime' },
};

export const ENTITLEMENT = 'pro';

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
