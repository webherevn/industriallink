import type {
  BillingCreditPolicyView,
  BillingPlanActionCostView,
  BillingPlanBillableAction,
} from '@industriallink/contracts';
import { BILLING_PLAN_BILLABLE_ACTIONS } from '@industriallink/contracts';

export function isBillableAction(action: string): action is BillingPlanBillableAction {
  return (BILLING_PLAN_BILLABLE_ACTIONS as readonly string[]).includes(action);
}

/** Cost mặc định V1 khi chưa có policy row. */
export function defaultCostForAction(action: string): number {
  return action === 'view_profile' ? 1 : 0;
}

export function policyCostForAction(
  policy: BillingCreditPolicyView | null | undefined,
  action: string,
): number {
  if (!policy) return defaultCostForAction(action);
  switch (action) {
    case 'view_profile':
      return policy.costPerProfile;
    case 'reopen_profile':
      return policy.costPerReopen;
    case 'view_applicant':
      return policy.costPerApplicant;
    case 'contact_potential':
      return policy.costPerContactPotential;
    case 'contact_applicant':
      return policy.costPerContactApplicant;
    case 'view_match_summary':
      return policy.costPerMatchSummary;
    default:
      return defaultCostForAction(action);
  }
}

export function defaultActionCostRows(
  policy: BillingCreditPolicyView | null | undefined,
): BillingPlanActionCostView[] {
  return BILLING_PLAN_BILLABLE_ACTIONS.map((action) => ({
    action,
    cost: policyCostForAction(policy, action),
    isActive: true,
  }));
}
