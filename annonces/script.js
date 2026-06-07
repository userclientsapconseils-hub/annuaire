const listEl = document.getElementById("annoncesList");
const statusEl = document.getElementById("annoncesStatus");
const form = document.getElementById("annoncesSearchForm");
const cpFilter = document.getElementById("cpFilter");
const activityFilter = document.getElementById("activityFilter");
let allOffers = [];

function parseApiData(payload) {
  if (payload === null || payload === undefined) return null;
  if (typeof payload === "string") {
    try { return JSON.parse(payload); } catch { return payload; }
  }
  return payload;
}

function normalizeApiCandidates(payload) {
  const parsed = parseApiData(payload);
  return Array.isArray(parsed) ? parsed : (parsed && typeof parsed === "object" ? [parsed] : []);
}

function normalizeText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getActivitySearchTerms(activity) {
  const normalized = normalizeText(activity);
  const aliases = {
    "jardiniers paysagistes": ["jardinier", "jardiniers", "paysagiste", "paysagistes"],
    "menage": ["menage", "nettoyage"],
    "cours a domicile": ["cours a domicile", "cours"]
  };

  return [normalized, ...(aliases[normalized] || [])].filter(Boolean);
}

function normalizePrestations(prestations) {
  if (Array.isArray(prestations)) {
    return prestations.map((item) => ({
      prestation: String(item?.prestation || item?.prestations || item?.nom || "").trim(),
      tarifHt: String(item?.tarifHt || item?.tarifHT || item?.tarif || "").trim()
    })).filter((item) => item.prestation || item.tarifHt);
  }

  if (typeof prestations === "string") {
    try { return normalizePrestations(JSON.parse(prestations)); } catch { return prestations.trim() ? [{ prestation: prestations.trim(), tarifHt: "" }] : []; }
  }

  return [];
}

function mapOffer(rawOffer) {
  const prestations = normalizePrestations(rawOffer?.prestations || rawOffer?.prestation);
  return {
    entreprise: String(rawOffer?.entreprise || "").trim(),
    activite: String(rawOffer?.activite || "").trim(),
    prestations,
    nom: String(rawOffer?.nom || "").trim(),
    prenom: String(rawOffer?.prenom || "").trim(),
    cp: String(rawOffer?.cp || "").trim(),
    ville: String(rawOffer?.ville || "").trim(),
    description: String(rawOffer?.description || "").trim()
  };
}

function getLocalOffers() {
  try {
    const draft = JSON.parse(localStorage.getItem("adDraft") || "null");
    return draft ? [draft] : [];
  } catch {
    return [];
  }
}

async function fetchOffers() {
  if (window.ApiClient?.findOffers) {
    const payload = await window.ApiClient.findOffers({});
    return normalizeApiCandidates(payload).map(mapOffer).filter(hasVisibleContent);
  }
  return getLocalOffers().map(mapOffer).filter(hasVisibleContent);
}

function hasVisibleContent(offer) {
  return offer.entreprise || offer.activite || offer.description || offer.prestations.length;
}

function matchesFilters(offer) {
  const cp = cpFilter.value.trim();
  const activite = activityFilter.value;
  const department = cp.slice(0, 2);
  const offerDepartment = offer.cp.slice(0, 2);
  const postalMatch = !cp || offer.cp === cp || (!!department && offerDepartment === department);
  const activityHaystack = normalizeText([offer.activite, ...offer.prestations.map((item) => item.prestation)].join(" "));
  const activityMatch = !activite || getActivitySearchTerms(activite).some((term) => activityHaystack.includes(term));
  return postalMatch && activityMatch;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function renderOffers(offers) {
  statusEl.textContent = `${offers.length} annonce${offers.length > 1 ? "s" : ""} affichée${offers.length > 1 ? "s" : ""}.`;

  if (!offers.length) {
    listEl.innerHTML = '<div class="empty">Aucune annonce ne correspond à ces critères.</div>';
    return;
  }

  listEl.innerHTML = offers.map((offer) => {
    const title = offer.entreprise || `${offer.prenom} ${offer.nom}`.trim() || "Professionnel";
    const description = offer.description || "Ce professionnel n’a pas encore ajouté de description détaillée.";
    const services = offer.prestations.slice(0, 3).map((item) => `<li>${escapeHtml(item.prestation || "Prestation")} ${item.tarifHt ? `— ${escapeHtml(item.tarifHt)}€ HT/h` : ""}</li>`).join("");

    return `
      <article class="ad-card">
        <h2>${escapeHtml(title)}</h2>
        <div class="ad-meta">
          ${offer.activite ? `<span class="pill">${escapeHtml(offer.activite)}</span>` : ""}
          ${offer.cp || offer.ville ? `<span class="pill">${escapeHtml([offer.cp, offer.ville].filter(Boolean).join(" "))}</span>` : ""}
        </div>
        <p>${escapeHtml(description).slice(0, 240)}${description.length > 240 ? "…" : ""}</p>
        ${services ? `<ul class="services">${services}</ul>` : ""}
      </article>
    `;
  }).join("");
}

function applyFilters() {
  renderOffers(allOffers.filter(matchesFilters));
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  applyFilters();
  const params = new URLSearchParams();
  if (cpFilter.value.trim()) params.set("cp", cpFilter.value.trim());
  if (activityFilter.value) params.set("activite", activityFilter.value);
  history.replaceState(null, "", `${location.pathname}${params.toString() ? `?${params}` : ""}`);
});

const nav = document.querySelector(".nav");
const menuToggle = document.querySelector(".menu-toggle");
const menuLinks = document.querySelectorAll(".menu a");
if (nav && menuToggle) {
  menuToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("menu-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });
  menuLinks.forEach((link) => link.addEventListener("click", () => {
    nav.classList.remove("menu-open");
    menuToggle.setAttribute("aria-expanded", "false");
  }));
}

(async () => {
  const params = new URLSearchParams(window.location.search);
  cpFilter.value = params.get("cp") || "";
  activityFilter.value = params.get("activite") || "";

  try {
    allOffers = await fetchOffers();
  } catch (error) {
    console.error("Impossible de charger les annonces :", error);
    allOffers = getLocalOffers().map(mapOffer).filter(hasVisibleContent);
  }

  applyFilters();
})();
