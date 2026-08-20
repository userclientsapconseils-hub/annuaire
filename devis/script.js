const params = new URLSearchParams(window.location.search);
const submitButton = document.getElementById('submitButton');
const serviceSelect = document.getElementById('service');
let selectedOffer = null;

const initialSession = AuthSession.get();
if (initialSession?.accountType === 'customer') {
  const emailInput = document.getElementById('email');
  emailInput.value = initialSession.email;
  emailInput.readOnly = true;
}

function normalizePrestations(value) {
  if (Array.isArray(value)) return value.map((item) => ({
    prestation: String(item?.prestation || item?.prestations || item?.nom || '').trim(),
    tarifHt: String(item?.tarifHt || item?.tarifHT || item?.tarif || '').trim()
  })).filter((item) => item.prestation || item.tarifHt);
  if (typeof value === 'string') {
    try { return normalizePrestations(JSON.parse(value)); } catch { return value.trim() ? [{ prestation: value.trim(), tarifHt: '' }] : []; }
  }
  return [];
}

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function getUserNumber(value) {
  const userNumber = Number(value);
  return Number.isSafeInteger(userNumber) && userNumber > 0 ? userNumber : null;
}

function mapOffer(raw = {}, index = 0) {
  const id = String(raw.id || raw._id || '').trim();
  const fallbackKey = [raw.mail, raw.entreprise, raw.cp, raw.ville, index].filter(Boolean).join('-');
  return {
    id, key: String(raw.key || id || normalizeText(fallbackKey) || `annonce-${index}`).trim(),
    entreprise: String(raw.entreprise || '').trim(), activite: String(raw.activite || '').trim(),
    prenom: String(raw.prenom || '').trim(), nom: String(raw.nom || '').trim(),
    cp: String(raw.cp || '').trim(), ville: String(raw.ville || '').trim(), mail: String(raw.mail || '').trim(),
    userNumber: getUserNumber(raw.userNumber),
    prestations: normalizePrestations(raw.prestations || raw.prestation)
  };
}

function requested(offer) {
  return (params.get('id') && offer.id === params.get('id')) || (params.get('offer') && offer.key === params.get('offer'));
}

function apiCandidates(payload) {
  if (typeof payload === 'string') { try { return apiCandidates(JSON.parse(payload)); } catch { return []; } }
  if (Array.isArray(payload)) return payload.flatMap(apiCandidates);
  if (!payload || typeof payload !== 'object') return [];
  const own = ['id','_id','entreprise','activite','prestations','prestation'].some((key) => key in payload) ? [payload] : [];
  return own.concat(['data','body','items','Items','records','results','offers','annonces'].flatMap((key) => key in payload ? apiCandidates(payload[key]) : []));
}

async function findOffer() {
  try {
    const stored = sessionStorage.getItem('selectedOffer');
    if (stored) { const offer = mapOffer(JSON.parse(stored)); if (requested(offer) && offer.userNumber) return offer; }
  } catch (error) { console.warn('Annonce mémorisée illisible :', error); }
  if (!window.ApiClient?.findOffers) return null;
  return apiCandidates(await window.ApiClient.findOffers({})).map(mapOffer).find(requested) || null;
}

function renderOffer(offer) {
  const name = offer.entreprise || `${offer.prenom} ${offer.nom}`.trim() || 'Professionnel';
  document.title = `Demande de devis — ${name}`;
  document.getElementById('offerHeading').textContent = name;
  document.getElementById('offerActivity').textContent = offer.activite || 'Professionnel';
  document.getElementById('offerLocation').textContent = [offer.cp, offer.ville].filter(Boolean).join(' ') || 'Non précisée';
  document.getElementById('offerServices').textContent = offer.prestations.map((item) => item.prestation).filter(Boolean).join(', ') || 'À définir avec le professionnel';
  serviceSelect.innerHTML = '<option value="">Choisir une prestation</option>';
  const services = offer.prestations.length ? offer.prestations : [{ prestation: 'Autre demande', tarifHt: '' }];
  services.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.prestation || 'Autre demande';
    option.textContent = `${option.value}${item.tarifHt ? ` — ${item.tarifHt} € HT/h` : ''}`;
    serviceSelect.append(option);
  });
  submitButton.disabled = !offer.userNumber;
  if (!offer.userNumber) document.getElementById('loadError').textContent = 'Cette annonce n’est pas encore reliée à un compte professionnel capable de recevoir une demande.';
}

document.getElementById('quoteForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!selectedOffer?.userNumber || !form.reportValidity()) return;
  const session = AuthSession.get();
  const status = document.getElementById('formStatus');
  if (!session || session.accountType !== 'customer') {
    status.className = 'status error';
    status.textContent = 'Connectez-vous avec un compte particulier pour envoyer une demande de devis.';
    return;
  }

  const data = new FormData(form);
  const payload = {
    requestId: window.crypto?.randomUUID?.() || `quote-${Date.now()}`,
    offerId: selectedOffer.id || selectedOffer.key,
    offerKey: selectedOffer.key,
    share: selectedOffer.userNumber,
    professionalUserNumber: selectedOffer.userNumber,
    professionalName: selectedOffer.entreprise || `${selectedOffer.prenom} ${selectedOffer.nom}`.trim(),
    activity: selectedOffer.activite,
    service: String(data.get('service')),
    customerFirstName: String(data.get('firstName')).trim(),
    customerLastName: String(data.get('lastName')).trim(),
    customerEmail: session.email,
    customerPhone: String(data.get('phone')).trim(),
    postalCode: String(data.get('postalCode')).trim(),
    desiredDate: String(data.get('desiredDate') || ''),
    message: String(data.get('message')).trim(),
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  submitButton.disabled = true;
  submitButton.textContent = 'Envoi en cours…';
  status.className = 'status';
  status.textContent = '';
  try {
    if (!window.ApiClient?.createQuoteRequest) throw new Error('API indisponible');
    const accountType = await window.ApiClient.getUserAccountType(session.token, session.email);
    if (accountType !== 'customer') {
      AuthSession.clear();
      throw new Error('Session particulier requise');
    }
    await window.ApiClient.createQuoteRequest(session.token, payload);
    form.reset();
    document.getElementById('email').value = session.email;
    status.className = 'status success';
    status.textContent = 'Votre demande a bien été transmise au professionnel. Elle est en attente de validation.';
  } catch (error) {
    console.error('Impossible d’enregistrer la demande de devis :', error);
    status.className = 'status error';
    status.textContent = 'Votre demande n’a pas pu être envoyée. Veuillez réessayer dans quelques instants.';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Envoyer ma demande';
  }
});

(async () => {
  const query = params.toString();
  document.getElementById('backToOffer').href = query ? `../annonce/annonceindex.html?${query}` : '../annonces/index.html';
  try {
    selectedOffer = await findOffer();
    if (selectedOffer) renderOffer(selectedOffer);
    else document.getElementById('loadError').textContent = 'Impossible de retrouver l’annonce sélectionnée. Revenez à la liste des annonces.';
  } catch (error) {
    console.error('Impossible de charger l’annonce :', error);
    document.getElementById('loadError').textContent = 'Le chargement de l’annonce est temporairement indisponible.';
  }
})();

