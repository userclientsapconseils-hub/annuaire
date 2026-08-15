function getStoredSession() {
  return AuthSession.get();
}

function clearSession() {
  AuthSession.clear();
}

function getActiveSession() {
  return getStoredSession();
}

function redirectToPersonalSpace(session = getActiveSession()) {
  if (!session?.accountType) return;
  window.location.href = session.accountType === "customer"
    ? "../espaceParticulier/index.html"
    : "../espacePersonnel/index.html";
}

function persistSession(token, email, accountType) {
  return AuthSession.persist(token, email, accountType);
}

function isAuthenticationRejection(error) {
  return [301, 401, 403, 404].includes(Number(error?.response?.status));
}

async function userAlreadyConnected() {
  const session = getActiveSession();
  if (!session) return false;

  const message = document.getElementById?.("message");
  if (message) {
    message.textContent = "Vérification de votre session...";
    message.className = "status show info";
  }

  try {
    const accountType = await ApiClient.getUserAccountType(
      session.token,
      session.email
    );

    if (!accountType || (session.accountType && accountType !== session.accountType)) {
      clearSession();
      if (message) message.className = "status";
      return false;
    }

    const verifiedSession = persistSession(session.token, session.email, accountType);
    redirectToPersonalSpace(verifiedSession);
    return true;
  } catch (error) {
    if (isAuthenticationRejection(error)) clearSession();
    if (message) {
      message.textContent = isAuthenticationRejection(error)
        ? "Votre session a expiré. Veuillez vous reconnecter."
        : "La vérification de votre session est temporairement indisponible.";
      message.className = "status show error";
    }
    return false;
  }
}

async function checkGuest(guest) {
  try {
    const token = await ApiClient.login(guest.mail, guest.password, guest.accountType);
    if (!token) throw "id";

    const verifiedAccountType = await ApiClient.getUserAccountType(
      token,
      guest.mail
    );
    if (verifiedAccountType !== AuthSession.normalizeAccountType(guest.accountType)) throw "id";

    guest.token = token;
    guest.session = persistSession(token, guest.mail, verifiedAccountType);
    guest.message.textContent = "Connexion réussie";
    guest.message.className = "status show success";
  } catch (error) {
    if (error === "id" || isAuthenticationRejection(error)) throw "id";
    throw "serveur";
  }
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
    session: null,
    button: document.getElementById("button"),
    message: document.getElementById("message")
  };

  try {
    changementStyleBoutton(guest, true);
    if (!guest.mail) throw "mail";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.mail)) throw "email";
    if (!guest.password) throw "password";
    if (!AuthSession.normalizeAccountType(guest.accountType)) throw "accountType";

    await checkGuest(guest);
    changementStyleBoutton(guest, false);
    if (guest.session) redirectToPersonalSpace(guest.session);
    return guest.token;
  } catch (error) {
    const messageList = {
      mail: "Veuillez indiquer votre adresse mail",
      email: "Veuillez saisir une adresse mail valide",
      password: "Veuillez indiquer votre mot de passe",
      accountType: "Veuillez choisir un type de compte valide",
      id: "Adresse e-mail ou mot de passe incorrect.",
      serveur: "Une erreur est survenue. Veuillez réessayer."
    };
    guest.message.textContent = messageList[error] || messageList.serveur;
    guest.message.className = "status show error";
    changementStyleBoutton(guest, false);
    return "";
  }
}

document.addEventListener("DOMContentLoaded", function () {
  userAlreadyConnected();
});
