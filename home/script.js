// Démo : affiche ce qui serait recherché (à remplacer par ta logique / redirection)
const form = document.getElementById("searchForm");
const hint = document.getElementById("hint");

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const cp = form.elements.cp.value.trim();
  const activite = form.elements.activite.value;

  // Validation simple (en plus du pattern HTML)
  if (!/^\d{5}$/.test(cp)) {
    hint.textContent = "Veuillez saisir un code postal à 5 chiffres.";
    return;
  }
  if (!activite) {
    hint.textContent = "Veuillez choisir une activité.";
    return;
  }

  // Exemple : construire une URL de recherche
  const url = `/recherche?cp=${encodeURIComponent(cp)}&activite=${encodeURIComponent(activite)}`;
  hint.textContent = `Recherche : ${cp} • ${activite} → ${url}`;

  // Si tu veux rediriger :
  // window.location.href = url;
});
