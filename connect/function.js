function userAlreadyConnected(token){
  //on parse le token
  if (!token) {return false}
  else{token = JSON.parse(token)}
  return true
  //a finaliser
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
    console.log(response.data)
    guest.message.textContent = "Votre token est "+response.data.data
    guest.message.className = "status success"
    return true
  
  }catch(e){
    if(e=="id"){throw e}
    else{throw "serveur"}
  }
}

function main(){
  try{
    console.log('init 2')
    //definition des variables
    let guest = {
      mail: document.getElementById("email").value,
      password: document.getElementById("password").value,
      message: document.getElementById("message"),
      token: '',
      user: {},
    }
    console.log(guest)
    //on regarde dans les cookies si un token existe déjà, si c'est le cas on connecte la personne
    userAlreadyConnected(guest.token)
    //sinon check des champs
    if(!guest.mail){throw "mail"}
    if(!guest.password){throw "password"}
    //connexion
    checkGuest(guest)
    
  }catch(e){
    const messageList={
      mail:"Veuillez indiquer votre adresse mail",
      password:"Veuillez indiquer votre mot de passe",
      id:"Le couple mail/mot de passe ne correpond pas",
      serveur:"Veuillez vérifier votre connexion / nos serveurs connaissent une pause, veuillez réessayer plus tard",
    }
    guest.message.textContent=messageList[e]
    guest.message.className = "status error"
  }    
}
  
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
