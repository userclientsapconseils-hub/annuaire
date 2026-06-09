const listEl = document.getElementById("annoncesList");
const statusEl = document.getElementById("annoncesStatus");
const form = document.getElementById("annoncesSearchForm");
const cpFilter = document.getElementById("cpFilter");
const activityFilter = document.getElementById("activityFilter");
const OFFERS_PER_PAGE = 20;
let allOffers = [];
let currentPage = 1;

function parseApiData(payload) {
  if (payload === null || payload === undefined) return null;
  if (typeof payload === "string") {
    try { return JSON.parse(payload); } catch { return payload; }
  }
  return payload;
}

const API_COLLECTION_KEYS = ["data", "body", "items", "Items", "records", "results", "offers", "annonces"];
const OFFER_FIELD_KEYS = ["entreprise", "activite", "prestation", "prestations", "description", "cp", "ville", "nom", "prenom", "mail"];

function hasOfferShape(value) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && OFFER_FIELD_KEYS.some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function collectApiCandidates(value, candidates, seen) {
  const parsed = parseApiData(value);

  if (parsed === null || parsed === undefined) return;

  if (Array.isArray(parsed)) {
    parsed.forEach((item) => collectApiCandidates(item, candidates, seen));
    return;
  }

  if (typeof parsed !== "object") return;

  if (seen.has(parsed)) return;
  seen.add(parsed);

  if (hasOfferShape(parsed)) {
    candidates.push(parsed);
  }

  API_COLLECTION_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
      collectApiCandidates(parsed[key], candidates, seen);
    }
  });
}

function normalizeApiCandidates(payload) {
  const candidates = [];
  collectApiCandidates(payload, candidates, new Set());
  return candidates;
}

function normalizeText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

async function fetchOffers() {
  if (!window.ApiClient?.findOffers) {
    return [];
  }

  const payload = await window.ApiClient.findOffers({});
  return normalizeApiCandidates(payload).map(mapOffer).filter(hasVisibleContent);
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
  const activityMatch = !activite || activityHaystack.includes(normalizeText(activite));
  return postalMatch && activityMatch;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function getTotalPages(offersCount) {
  return Math.max(1, Math.ceil(offersCount / OFFERS_PER_PAGE));
}

function buildPagination(totalPages) {
  if (totalPages <= 1) return "";

  return `
    <nav class="pagination" aria-label="Pagination des annonces">
      <button type="button" class="pagination-btn" data-page-action="prev" ${currentPage === 1 ? "disabled" : ""}>Précédent</button>
      <span class="pagination-info">Page ${currentPage} sur ${totalPages}</span>
      <button type="button" class="pagination-btn" data-page-action="next" ${currentPage === totalPages ? "disabled" : ""}>Suivant</button>
    </nav>
  `;
}

function bindPaginationButtons(totalPages) {
  listEl.querySelectorAll("[data-page-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.pageAction;
      if (action === "next" && currentPage < totalPages) {
        currentPage += 1;
      }
      if (action === "prev" && currentPage > 1) {
        currentPage -= 1;
      }
      applyFilters();
      listEl.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function renderOffers(offers) {
  const totalPages = getTotalPages(offers.length);
  currentPage = Math.min(currentPage, totalPages);
  const startIndex = (currentPage - 1) * OFFERS_PER_PAGE;
  const visibleOffers = offers.slice(startIndex, startIndex + OFFERS_PER_PAGE);

  if (!offers.length) {
    statusEl.textContent = "0 annonce affichée.";
    listEl.innerHTML = '<div class="empty">Aucune annonce ne correspond à ces critères.</div>';
    return;
  }

  statusEl.textContent = `${startIndex + 1}-${startIndex + visibleOffers.length} sur ${offers.length} annonce${offers.length > 1 ? "s" : ""} affichée${offers.length > 1 ? "s" : ""}.`;

  const cards = visibleOffers.map((offer) => {
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

  listEl.innerHTML = `${cards}${buildPagination(totalPages)}`;
  bindPaginationButtons(totalPages);
}

function applyFilters() {
  renderOffers(allOffers.filter(matchesFilters));
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  currentPage = 1;
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
    console.error("Impossible de charger les annonces depuis l'API :", error);
    allOffers = [];
  }

  applyFilters();
})();
