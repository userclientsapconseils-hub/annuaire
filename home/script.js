const form = document.getElementById("searchForm");
const hint = document.getElementById("hint");
const resultsContainer = document.getElementById("searchResults");
const INITIAL_RESULTS_LIMIT = 3;

let currentResults = [];
let lastSearch = { cp: "", activite: "" };

function parseApiData(payload) {
  if (payload === null || payload === undefined) return null;
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return payload;
    }
  }
  return payload;
}

function normalizeApiCandidates(payload) {
  const parsed = parseApiData(payload);
  return Array.isArray(parsed)
    ? parsed
    : (parsed && typeof parsed === "object" ? [parsed] : []);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizePrestations(prestations) {
  if (Array.isArray(prestations)) {
    return prestations
      .map((item) => ({
        prestation: String(item?.prestation || item?.prestations || item?.nom || "").trim(),
        tarifHt: String(item?.tarifHt || item?.tarifHT || item?.tarif || "").trim()
      }))
      .filter((item) => item.prestation || item.tarifHt);
  }

  if (typeof prestations === "string") {
    try {
      return normalizePrestations(JSON.parse(prestations));
    } catch {
      return prestations.trim() ? [{ prestation: prestations.trim(), tarifHt: "" }] : [];
    }
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
    adresse1: String(rawOffer?.adresse1 || rawOffer?.adresse || "").trim(),
    adresse2: String(rawOffer?.adresse2 || "").trim(),
    description: String(rawOffer?.description || "").trim()
  };
}

function getLocalOffers() {
  return ["lastPublishedAd", "adDraft"]
    .map((key) => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function fetchOffers(cp = "", activite = "") {
  if (window.ApiClient?.findOffers) {
    try {
      const payload = await window.ApiClient.findOffers({ cp, activite });
      let offers = normalizeApiCandidates(payload).map(mapOffer).filter((offer) => offer.entreprise || offer.activite || offer.description);
      if (!offers.length && cp) {
        offers = normalizeApiCandidates(await window.ApiClient.findOffers({ cp })).map(mapOffer).filter((offer) => offer.entreprise || offer.activite || offer.description);
      }
      if (!offers.length) {
        offers = normalizeApiCandidates(await window.ApiClient.findOffers({})).map(mapOffer).filter((offer) => offer.entreprise || offer.activite || offer.description);
      }
      if (offers.length) return offers;
    } catch (error) {
      console.error("Recherche API indisponible :", error);
      const localOffers = getLocalOffers().map(mapOffer).filter((offer) => offer.entreprise || offer.activite || offer.description);
      if (localOffers.length) return localOffers;
      throw error;
    }
  }

  return getLocalOffers().map(mapOffer).filter((offer) => offer.entreprise || offer.activite || offer.description);
}

function matchesSearch(offer, cp, activite) {
  const searchedActivity = normalizeText(activite);
  const activityHaystack = normalizeText([
    offer.activite,
    ...offer.prestations.map((item) => item.prestation)
  ].join(" "));
  const activityMatches = Boolean(activityHaystack) && (activityHaystack.includes(searchedActivity) || searchedActivity.includes(activityHaystack));

  const searchedDepartment = cp.slice(0, 2);
  const offerDepartment = offer.cp.slice(0, 2);
  const postalMatches = offer.cp === cp || (!!searchedDepartment && offerDepartment === searchedDepartment);

  return activityMatches && postalMatches;
}

function scoreOffer(offer, cp, activite) {
  let score = 0;
  if (offer.cp === cp) score += 10;
  if (normalizeText(offer.activite) === normalizeText(activite)) score += 6;
  if (offer.description) score += 1;
  if (offer.prestations.length) score += 1;
  return score;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildMoreResultsUrl() {
  const params = new URLSearchParams();
  if (lastSearch.cp) params.set("cp", lastSearch.cp);
  if (lastSearch.activite) params.set("activite", lastSearch.activite);
  return `annonces/index.html${params.toString() ? `?${params.toString()}` : ""}`;
}

function renderResults() {
  if (!resultsContainer) return;

  resultsContainer.classList.add("show");

  if (!currentResults.length) {
    resultsContainer.innerHTML = '<div class="results-empty">Aucune annonce ne correspond à cette recherche pour le moment.</div>';
    return;
  }

  const visibleOffers = currentResults.slice(0, INITIAL_RESULTS_LIMIT);
  const cards = visibleOffers.map((offer) => {
    const title = offer.entreprise || `${offer.prenom} ${offer.nom}`.trim() || "Professionnel";
    const prestations = offer.prestations.slice(0, 2).map((item) => item.prestation).filter(Boolean).join(" • ");
    const description = offer.description || prestations || "Consultez cette annonce pour découvrir les prestations proposées.";
    const price = offer.prestations.find((item) => item.tarifHt)?.tarifHt;

    return `
      <article class="result-card">
        <h2>${escapeHtml(title)}</h2>
        <div class="result-meta">
          ${offer.activite ? `<span class="result-pill">${escapeHtml(offer.activite)}</span>` : ""}
          ${offer.cp || offer.ville ? `<span class="result-pill">${escapeHtml([offer.cp, offer.ville].filter(Boolean).join(" "))}</span>` : ""}
          ${price ? `<span class="result-pill">Dès ${escapeHtml(price)}€ HT/h</span>` : ""}
        </div>
        <p class="result-desc">${escapeHtml(description).slice(0, 180)}${description.length > 180 ? "…" : ""}</p>
      </article>
    `;
  }).join("");

  const loadMoreButton = currentResults.length > INITIAL_RESULTS_LIMIT
    ? `<a class="load-more-results" href="${escapeHtml(buildMoreResultsUrl())}">En savoir plus</a>`
    : "";

  resultsContainer.innerHTML = `<div class="results-grid">${cards}</div>${loadMoreButton}`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const cp = form.elements.cp.value.trim();
  const activite = form.elements.activite.value;

  if (!/^\d{5}$/.test(cp)) {
    hint.textContent = "Veuillez saisir un code postal à 5 chiffres.";
    return;
  }
  if (!activite) {
    hint.textContent = "Veuillez choisir une activité.";
    return;
  }

  hint.textContent = "Recherche des annonces correspondantes...";
  resultsContainer.innerHTML = "";
  resultsContainer.classList.remove("show");

  try {
    const offers = await fetchOffers(cp, activite);
    currentResults = offers
      .filter((offer) => matchesSearch(offer, cp, activite))
      .sort((a, b) => scoreOffer(b, cp, activite) - scoreOffer(a, cp, activite));
    lastSearch = { cp, activite };
    hint.textContent = `${currentResults.length} annonce${currentResults.length > 1 ? "s" : ""} trouvée${currentResults.length > 1 ? "s" : ""} pour ${cp}.`;
    renderResults();
  } catch (error) {
    hint.textContent = "Impossible d'interroger les annonces pour le moment.";
    resultsContainer.classList.add("show");
    resultsContainer.innerHTML = '<div class="results-error">La recherche est temporairement indisponible. Réessayez dans quelques instants.</div>';
  }
});

const nav = document.querySelector('.nav');
const menuToggle = document.querySelector('.menu-toggle');
const menuLinks = document.querySelectorAll('.menu a');

if (nav && menuToggle) {
  menuToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('menu-open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });

  menuLinks.forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('menu-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 720) {
      nav.classList.remove('menu-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  });
}
