const nav = document.querySelector('.nav');
const menuToggle = document.querySelector('.menu-toggle');
const menuLinks = document.querySelectorAll('.menu a');

function parseApiData(payload) {
  if (payload === null || payload === undefined) return null;
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch {
      return payload;
    }
  }
  return payload;
}

const API_COLLECTION_KEYS = ['data', 'body', 'items', 'Items', 'records', 'results', 'offers', 'annonces'];
const OFFER_FIELD_KEYS = ['id', '_id', 'entreprise', 'activite', 'prestation', 'prestations', 'description', 'cp', 'ville', 'nom', 'prenom', 'mail'];

function hasOfferShape(value) {
  return value
    && typeof value === 'object'
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

  if (typeof parsed !== 'object') return;

  if (seen.has(parsed)) return;
  seen.add(parsed);

  if (hasOfferShape(parsed)) candidates.push(parsed);

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
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizePrestations(prestations) {
  if (Array.isArray(prestations)) {
    return prestations
      .map((item) => ({
        prestation: String(item?.prestation || item?.prestations || item?.nom || '').trim(),
        tarifHt: String(item?.tarifHt || item?.tarifHT || item?.tarif || '').trim()
      }))
      .filter((item) => item.prestation || item.tarifHt);
  }

  if (typeof prestations === 'string') {
    try {
      return normalizePrestations(JSON.parse(prestations));
    } catch {
      return prestations.trim() ? [{ prestation: prestations.trim(), tarifHt: '' }] : [];
    }
  }

  return [];
}

function getApiRecordId(record) {
  if (!record || typeof record !== 'object') return '';
  return String(record.id || record._id || '').trim();
}

function mapOffer(rawOffer, index = 0) {
  const prestations = normalizePrestations(rawOffer?.prestations || rawOffer?.prestation);
  const mail = String(rawOffer?.mail || '').trim();
  const fallbackKey = [mail, rawOffer?.entreprise, rawOffer?.cp, rawOffer?.ville, index].filter(Boolean).join('-');

  return {
    id: getApiRecordId(rawOffer),
    key: String(rawOffer?.key || getApiRecordId(rawOffer) || normalizeText(fallbackKey) || `annonce-${index}`).trim(),
    entreprise: String(rawOffer?.entreprise || '').trim(),
    activite: String(rawOffer?.activite || '').trim(),
    prestations,
    nom: String(rawOffer?.nom || '').trim(),
    prenom: String(rawOffer?.prenom || '').trim(),
    cp: String(rawOffer?.cp || '').trim(),
    ville: String(rawOffer?.ville || '').trim(),
    adresse1: String(rawOffer?.adresse1 || rawOffer?.adresse || '').trim(),
    adresse2: String(rawOffer?.adresse2 || '').trim(),
    mail,
    description: String(rawOffer?.description || '').trim()
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getStoredOffer() {
  try {
    const stored = sessionStorage.getItem('selectedOffer');
    return stored ? mapOffer(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}

function matchesRequestedOffer(offer, params) {
  const requestedId = params.get('id') || '';
  const requestedKey = params.get('offer') || '';
  return (requestedId && offer.id === requestedId) || (requestedKey && offer.key === requestedKey);
}

async function fetchRequestedOffer(params) {
  const storedOffer = getStoredOffer();
  if (storedOffer && matchesRequestedOffer(storedOffer, params)) return storedOffer;

  if (!window.ApiClient?.findOffers) return null;

  const candidates = normalizeApiCandidates(await window.ApiClient.findOffers({})).map(mapOffer);
  return candidates.find((offer) => matchesRequestedOffer(offer, params)) || null;
}

function getInitials(offer) {
  const source = `${offer.prenom} ${offer.nom}`.trim() || offer.entreprise || 'Professionnel';
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('') || 'PR';
}

function renderOffer(offer) {
  const title = offer.entreprise || `${offer.prenom} ${offer.nom}`.trim() || 'Professionnel';
  const proName = `${offer.prenom} ${offer.nom}`.trim() || title;
  const firstPrice = offer.prestations.find((item) => item.tarifHt)?.tarifHt;
  const description = offer.description || 'Ce professionnel n’a pas encore ajouté de description détaillée.';
  const zone = offer.cp ? `${offer.cp.slice(0, 2)}**` : '-';
  const details = [
    ['Code postal', offer.cp || '-'],
    ['Ville', offer.ville || '-'],
    ['Zone couverte', zone],
    ['Adresse', [offer.adresse1, offer.adresse2].filter(Boolean).join(', ') || '-'],
    ['Email', offer.mail || '-']
  ];

  document.title = `${title} — Annonce`;
  document.getElementById('offerTitle').textContent = title;
  document.getElementById('offerMeta').innerHTML = [
    offer.cp || offer.ville ? `<span class="pill">Zone : ${escapeHtml([offer.cp, offer.ville].filter(Boolean).join(' '))}</span>` : '',
    offer.activite ? `<span class="pill">Activité : ${escapeHtml(offer.activite)}</span>` : '',
    firstPrice ? `<span class="pill">À partir de ${escapeHtml(firstPrice)}€ HT/h</span>` : ''
  ].filter(Boolean).join('');
  document.getElementById('offerDescription').textContent = description;
  document.getElementById('offerServices').innerHTML = offer.prestations.length
    ? offer.prestations.map((item) => `<li>${escapeHtml(item.prestation || 'Prestation')}${item.tarifHt ? ` — ${escapeHtml(item.tarifHt)}€ HT/h` : ''}</li>`).join('')
    : '<li>Prestations à préciser avec le professionnel.</li>';
  document.getElementById('proAvatar').textContent = getInitials(offer);
  document.getElementById('proName').textContent = proName;
  document.getElementById('proSubtitle').textContent = offer.activite || 'Professionnel';
  document.getElementById('offerDetails').innerHTML = details
    .map(([label, value]) => `<div class="kv-row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`)
    .join('');

  const contactHref = offer.mail ? `mailto:${encodeURIComponent(offer.mail)}?subject=${encodeURIComponent(`Contact pour votre annonce ${title}`)}` : '../connect/index.html';
  document.getElementById('contactButton').href = contactHref;
  document.getElementById('quoteButton').href = contactHref;
}

async function loadDynamicOffer() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('offer') && !params.has('id')) return;

  try {
    const offer = await fetchRequestedOffer(params);
    if (offer) {
      renderOffer(offer);
      return;
    }
    document.getElementById('offerDescription').textContent = "Impossible de retrouver cette annonce. Revenez à la liste des annonces pour la sélectionner à nouveau.";
  } catch (error) {
    console.error("Impossible de charger l'annonce demandée :", error);
    document.getElementById('offerDescription').textContent = "Le chargement de cette annonce est temporairement indisponible.";
  }
}

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
    if (window.innerWidth > 900) {
      nav.classList.remove('menu-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

loadDynamicOffer();
