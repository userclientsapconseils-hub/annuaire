const assert = require("node:assert/strict");
const BillingPlans = require("./plans.js");

assert.deepEqual(BillingPlans.PLAN_IDS, ["free", "standard", "premium"]);
assert.equal(BillingPlans.catalog.free.monthlyPriceHt, 0);
assert.equal(BillingPlans.catalog.standard.monthlyPriceHt, 5);
assert.equal(BillingPlans.catalog.premium.monthlyPriceHt, 10);

const existingProfessional = BillingPlans.normalizeSubscription();
assert.equal(existingProfessional.plan, "free");
assert.equal(existingProfessional.accessPlan, "free");
assert.equal(existingProfessional.status, "none");

const activeStandard = BillingPlans.normalizeSubscription({
  plan: "standard",
  subscriptionStatus: "active",
  capabilities: ["listing.highlight", " listing.highlight ", "", 42]
});
assert.equal(activeStandard.plan, "standard");
assert.equal(activeStandard.accessPlan, "standard");
assert.deepEqual(activeStandard.capabilities, ["listing.highlight"]);

const canceledPremium = BillingPlans.normalizeSubscription({
  plan: "premium",
  subscriptionStatus: "canceled"
});
assert.equal(canceledPremium.plan, "premium");
assert.equal(canceledPremium.accessPlan, "free");

const apiControlledAccess = BillingPlans.normalizeSubscription({
  plan: "premium",
  accessPlan: "standard",
  subscriptionStatus: "past_due"
});
assert.equal(apiControlledAccess.accessPlan, "standard");

const invalidPayload = BillingPlans.normalizeSubscription({
  plan: "enterprise",
  accessPlan: "unknown",
  subscriptionStatus: "mystery"
});
assert.equal(invalidPayload.plan, "free");
assert.equal(invalidPayload.accessPlan, "free");
assert.equal(invalidPayload.status, "none");

console.log("Tests des offres professionnelles : OK");
