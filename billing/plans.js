(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.BillingPlans = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PLAN_IDS = Object.freeze(["free", "standard", "premium"]);
  const SUBSCRIPTION_STATUSES = Object.freeze([
    "none",
    "incomplete",
    "trialing",
    "active",
    "past_due",
    "canceled",
    "unpaid"
  ]);

  const catalog = Object.freeze({
    free: Object.freeze({
      id: "free",
      label: "Gratuite",
      monthlyPriceHt: 0,
      description: "Pour présenter votre activité et gérer votre annonce.",
      features: Object.freeze([
        "Créer et gérer une annonce professionnelle",
        "Recevoir et traiter les demandes de devis"
      ])
    }),
    standard: Object.freeze({
      id: "standard",
      label: "Standard",
      monthlyPriceHt: 5,
      description: "Une formule mensuelle pour développer votre présence.",
      features: Object.freeze([
        "Fonctionnalités complémentaires à définir",
        "Activation après confirmation du paiement par l’API"
      ])
    }),
    premium: Object.freeze({
      id: "premium",
      label: "Premium",
      monthlyPriceHt: 10,
      description: "La formule mensuelle la plus complète.",
      features: Object.freeze([
        "Fonctionnalités avancées à définir",
        "Activation après confirmation du paiement par l’API"
      ])
    })
  });

  function normalizePlan(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return PLAN_IDS.includes(normalized) ? normalized : "free";
  }

  function normalizeStatus(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return SUBSCRIPTION_STATUSES.includes(normalized) ? normalized : "none";
  }

  function getPlan(value) {
    return catalog[normalizePlan(value)];
  }

  function formatMonthlyPrice(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return "0 €";
    return `${amount.toLocaleString("fr-FR")} € HT / mois`;
  }

  function normalizeCapabilities(value) {
    if (!Array.isArray(value)) return [];

    return [...new Set(
      value
        .filter((capability) => typeof capability === "string")
        .map((capability) => capability.trim())
        .filter(Boolean)
    )];
  }

  function normalizeSubscription(payload) {
    const source = payload && typeof payload === "object" ? payload : {};
    const plan = normalizePlan(source.plan || source.subscriptionPlan || source.tier);
    const status = normalizeStatus(source.subscriptionStatus || source.status);
    const hasExplicitAccessPlan = typeof source.accessPlan === "string";
    const accessPlan = hasExplicitAccessPlan
      ? normalizePlan(source.accessPlan)
      : (["active", "trialing"].includes(status) ? plan : "free");

    return Object.freeze({
      plan,
      planDetails: getPlan(plan),
      accessPlan,
      accessPlanDetails: getPlan(accessPlan),
      status,
      currentPeriodEnd: typeof source.currentPeriodEnd === "string" ? source.currentPeriodEnd : null,
      cancelAtPeriodEnd: source.cancelAtPeriodEnd === true,
      capabilities: Object.freeze(normalizeCapabilities(source.capabilities))
    });
  }

  return Object.freeze({
    PLAN_IDS,
    SUBSCRIPTION_STATUSES,
    catalog,
    normalizePlan,
    normalizeStatus,
    normalizeSubscription,
    getPlan,
    formatMonthlyPrice
  });
});
