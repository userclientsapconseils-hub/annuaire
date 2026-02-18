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
