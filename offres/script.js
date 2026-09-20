(function () {
  "use strict";

  const grid = document.getElementById("plansGrid");
  const currentPlanMessage = document.getElementById("currentPlanMessage");

  function getProfessionalSession() {
    try {
      const session = window.AuthSession?.get?.();
      const accountType = window.AuthSession?.normalizeAccountType?.(session?.accountType);
      return session?.token && session?.email && accountType === "pro" ? session : null;
    } catch {
      return null;
    }
  }

  function createFeature(text) {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }

  function createPlanCard(plan, currentPlanId, isProfessional) {
    const card = document.createElement("article");
    card.className = "plan-card";
    card.dataset.plan = plan.id;

    if (plan.id === currentPlanId && isProfessional) {
      const badge = document.createElement("span");
      badge.className = "plan-badge";
      badge.textContent = "Votre offre";
      card.appendChild(badge);
    }

    const title = document.createElement("h2");
    title.textContent = plan.label;

    const price = document.createElement("p");
    price.className = "plan-price";
    const amount = document.createElement("strong");
    amount.textContent = `${plan.monthlyPriceHt} €`;
    const period = document.createElement("span");
    period.textContent = plan.monthlyPriceHt === 0 ? "sans abonnement" : "HT / mois";
    price.append(amount, period);

    const description = document.createElement("p");
    description.className = "plan-description";
    description.textContent = plan.description;

    const features = document.createElement("ul");
    features.className = "plan-features";
    plan.features.forEach((feature) => features.appendChild(createFeature(feature)));

    let action;
    if (plan.id === "free") {
      action = document.createElement("a");
      action.className = "plan-action secondary";
      action.href = isProfessional ? "../espacePersonnel/index.html" : "../submit/submitindex.html";
      action.textContent = isProfessional ? "Accéder à mon espace" : "Créer un compte professionnel";
    } else {
      action = document.createElement("button");
      action.type = "button";
      action.className = "plan-action";
      action.disabled = true;
      action.textContent = "Paiement bientôt disponible";
      action.setAttribute("aria-label", `Souscription à l’offre ${plan.label} bientôt disponible`);
    }

    card.append(title, price, description, features, action);
    return card;
  }

  function renderPlans(subscriptionPayload) {
    const isProfessional = Boolean(getProfessionalSession());
    const subscription = BillingPlans.normalizeSubscription(subscriptionPayload);
    const currentPlanId = isProfessional ? subscription.accessPlan : "";

    grid.replaceChildren();
    BillingPlans.PLAN_IDS.forEach((planId) => {
      grid.appendChild(createPlanCard(BillingPlans.catalog[planId], currentPlanId, isProfessional));
    });

    currentPlanMessage.textContent = isProfessional
      ? `Votre offre actuelle : ${subscription.accessPlanDetails.label}.`
      : "Connectez-vous avec un compte professionnel pour retrouver votre offre.";
  }

  window.renderProfessionalPlans = renderPlans;
  renderPlans(null);
})();
