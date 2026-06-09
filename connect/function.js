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
    console.error("Session invalide dans le stockage local :", error);
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem("token");
  localStorage.removeItem("userEmail");
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
  window.location.href = "../espacePersonnel/index.html";
}

function userAlreadyConnected() {
  const session = getActiveSession();

  if (!session) return false;

  // On prolonge la session valide pour éviter de redemander les identifiants
  // lorsque l'utilisateur revient sur la page de connexion.
  persistSession(session.token, session.email);
  redirectToPersonalSpace();
  return true;
}

function extractToken(payload){
  if (!payload) return "";

  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload);
      if (parsed && typeof parsed === "object") {
        return parsed.token || parsed.data || "";
      }
      return payload;
    } catch (_error) {
      return payload;
    }
  }

  if (typeof payload === "object") {
    return payload.token || payload.data || "";
  }

  return "";
}

function persistSession(token, email) {
  const session = {
    token,
    email,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem("token", token);
  localStorage.setItem("userEmail", email);
}

async function checkGuest(guest){
  try{
  let url = 'https://de3qg7ntqblkinxmxfhqoisuhi0pckix.lambda-url.eu-west-3.on.aws/' //mongoProd
  let body = {
      request:'token',
      collection:'user',
      data:{
        mail:guest.mail,
        password:guest.password,
      }
    }
    let response = await axios({method:'post', url:url, headers:{}, data:body})
      .then(response => {return response})
      .catch(response=>{throw "id"})
    //if success
    const token = extractToken(response?.data?.data)
    if (!token) {throw "id"}
    guest.token = token
    persistSession(token, guest.mail)
    guest.message.textContent = "Connexion réussie"
    guest.message.className = "status show success"
    cookieWrite(token)
  //if fail
  }catch(e){
    if(e=="id"){throw e}
    else{throw "serveur"}
  }
}

function cookieWrite(token){
  document.cookie = "token="+encodeURIComponent(token)+"; path=/annuaire; max-age="+(SESSION_TTL_MS / 1000)+"; SameSite=Lax; Secure"
  console.log(decodeURIComponent(document.cookie))
}

function changementStyleBoutton(guest, connectionEnCours){
  if(connectionEnCours){
    guest.button.className = "button disabled";
    guest.button.textContent = "Connexion en cours...";
    guest.message.className = "status"
  }else{
    guest.button.className = "button";
    guest.button.textContent = "Se connecter"
  }
}




async function main(){
  console.log('v7')
  //definition des variables
  let guest = {
    mail: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value,
    token: '',  
    button: document.getElementById("button"),
    message: document.getElementById("message"),
  }
  //console.log(guest)
  try{
    changementStyleBoutton(guest, true)
    // Si une session locale valide existe déjà, on ouvre directement l'espace personnel.
    if(userAlreadyConnected()){return guest.token}
    //sinon check des champs
    if(!guest.mail){throw "mail"}
    if(!guest.password){throw "password"}
    //connexion
    await checkGuest(guest)
    changementStyleBoutton(guest, false)
    if (guest.token) {
      redirectToPersonalSpace()
    }
    return guest.token
  }catch(e){
    const messageList={
      mail:"Veuillez indiquer votre adresse mail",
      password:"Veuillez indiquer votre mot de passe",
      id:"Le couple mail/mot de passe ne correpond pas",
      serveur:"Veuillez vérifier votre connexion / nos serveurs connaissent une pause, veuillez réessayer plus tard",
    }
    guest.message.textContent=messageList[e]
    guest.message.className = "status show error"
    changementStyleBoutton(guest, false)
  }    
}


document.addEventListener("DOMContentLoaded", function() {
  userAlreadyConnected();
});

  
/*const SESSION_KEY = "authSession";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const submitBtn = document.getElementById("submitBtn");
const message = document.getElementById("message");


function showMessage(text, type) {
  message.className = "status show " + type;
  message.textContent = text;
}

function getStoredSession() {
  const rawSession = localStorage.getItem(SESSION_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    const session = JSON.parse(rawSession);

    if (!session || !session.token || !session.email) {
      return null;
    }

    return session;
  } catch (error) {
    console.error("Session invalide :", error);
    return null;
  }
}

function isSessionActive(session) {
  if (!session || !session.token || !session.email) {
    return false;
  }

  if (!session.expiresAt) {
    return false;
  }

  return Date.now() < Number(session.expiresAt);
}

function persistSession(token, email) {
  const session = {
    token,
    email,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem("token", token);
  localStorage.setItem("userEmail", email);
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem("token");
  localStorage.removeItem("userEmail");
}

loginForm.addEventListener("submit", async function(event) {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email) {
    showMessage("Veuillez renseigner votre adresse mail.", "error");
    return;
  }

  if (!password) {
    showMessage("Veuillez renseigner votre mot de passe.", "error");
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = "Connexion en cours...";
    showMessage("Vérification de vos identifiants...", "info");

    const token = await ApiClient.login(email, password);

    if (!token) {
      showMessage("Identifiants incorrects. Vérifiez votre mail et votre mot de passe.", "error");
      return;
    }

    persistSession(token, email);
    showMessage("Connexion réussie. Redirection vers votre dashboard...", "success");
    window.location.href = "dashboard.html";
  } catch (error) {
    console.error("Erreur de connexion :", error);
    showMessage("Impossible de se connecter pour le moment. Réessayez dans quelques instants.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Se connecter";
  }
});

const existingSession = getStoredSession();
if (isSessionActive(existingSession)) {
  showMessage("Session active détectée, redirection vers votre dashboard...", "info");
  window.location.href = "dashboard.html";
} else {
  clearSession();
}

const savedEmail = localStorage.getItem("userEmail");
if (savedEmail) {
  emailInput.value = savedEmail;
}*/
