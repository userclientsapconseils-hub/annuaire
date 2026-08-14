const SESSION_KEY = "authSession";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

function getStoredSession() {
  const rawSession = localStorage.getItem(SESSION_KEY);
  const legacyToken = localStorage.getItem("token");
  const legacyEmail = localStorage.getItem("userEmail");

  if (!rawSession) {
    if (legacyToken && legacyEmail) {
      return { token: legacyToken, email: legacyEmail, expiresAt: null };
    }
    return null;
  }

  try {
    const session = JSON.parse(rawSession);
    if (!session?.token || !session?.email) return null;
    return session;
  } catch (error) {
    console.warn("Session invalide dans le stockage local.");
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem("token");
  localStorage.removeItem("userEmail");
  localStorage.removeItem("accountType");
}

function getActiveSession() {
  const session = getStoredSession();
  if (!session?.token || !session?.email) return null;
  if (session.expiresAt && Date.now() >= Number(session.expiresAt)) {
    clearSession();
    return null;
  }
  return session;
}

function redirectToPersonalSpace() {
  const session = getActiveSession();
  const accountType = session?.accountType || localStorage.getItem("accountType") || "pro";
  window.location.href = accountType === "customer" || accountType === "particulier"
    ? "../espaceParticulier/index.html"
    : "../espacePersonnel/index.html";
}

function userAlreadyConnected() {
  const session = getActiveSession();
  if (!session) return false;
  persistSession(session.token, session.email, session.accountType);
  redirectToPersonalSpace();
  return true;
}

function persistSession(token, email, accountType = "pro") {
  const session = {
    token,
    email,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    accountType
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem("token", token);
  localStorage.setItem("userEmail", email);
  localStorage.setItem("accountType", accountType);
}

async function checkGuest(guest) {
  try {
    const token = await ApiClient.login(guest.mail, guest.password, guest.accountType);
    if (!token) throw "id";
    const verifiedAccountType = await ApiClient.getUserAccountType(token, guest.mail, guest.accountType);
    if (verifiedAccountType !== guest.accountType) throw "id";
    guest.token = token;
    persistSession(token, guest.mail, verifiedAccountType);
    guest.message.textContent = "Connexion réussie";
    guest.message.className = "status show success";
    cookieWrite(token);
  } catch (error) {
    if (error === "id") throw error;
    if (error?.response?.status === 401 || error?.response?.status === 403) throw "id";
    throw "serveur";
  }
}

function cookieWrite(token) {
  document.cookie = "token=" + encodeURIComponent(token) + "; path=/annuaire; max-age=" + (SESSION_TTL_MS / 1000) + "; SameSite=Lax; Secure";
}

function changementStyleBoutton(guest, connectionEnCours) {
  if (connectionEnCours) {
    guest.button.className = "button disabled";
    guest.button.disabled = true;
    guest.button.textContent = "Connexion en cours...";
    guest.message.className = "status";
  } else {
    guest.button.className = "button";
    guest.button.disabled = false;
    guest.button.textContent = "Se connecter";
  }
}

async function main() {
  const guest = {
    mail: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value,
    accountType: document.getElementById("accountType").value,
    token: "",
    button: document.getElementById("button"),
    message: document.getElementById("message")
  };

  try {
    changementStyleBoutton(guest, true);
    if (userAlreadyConnected()) return guest.token;
    if (!guest.mail) throw "mail";
    if (!guest.password) throw "password";
    await checkGuest(guest);
    changementStyleBoutton(guest, false);
    if (guest.token) redirectToPersonalSpace();
    return guest.token;
  } catch (error) {
    const messageList = {
      mail: "Veuillez indiquer votre adresse mail",
      password: "Veuillez indiquer votre mot de passe",
      id: "Le couple mail/mot de passe ne correspond pas",
      serveur: "Veuillez vérifier votre connexion / nos serveurs connaissent une pause, veuillez réessayer plus tard"
    };
    guest.message.textContent = messageList[error] || messageList.serveur;
    guest.message.className = "status show error";
    changementStyleBoutton(guest, false);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  userAlreadyConnected();
});
