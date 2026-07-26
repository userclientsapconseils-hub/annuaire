(function () {
  const currentScript = document.currentScript;
  const defaultRoot = currentScript?.src ? new URL("../", currentScript.src).href : "../";

  document.querySelectorAll("[data-site-header]").forEach((host) => {
    const root = new URL(host.dataset.root || defaultRoot, document.baseURI);
    const href = (path) => new URL(path, root).href;

    host.classList.add("site-header");
    host.innerHTML = `
      <header class="nav">
        <div class="nav-left">
          <a class="brand" href="${href("index.html")}">
            <svg class="pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c-3.86 0-7 3.14-7 7 0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>
            <span>Accueil</span>
          </a>
          <nav class="menu" id="mainMenu" aria-label="Menu principal">
            <a href="${href("inscriptiontest.html")}">Les Prestations</a>
            <a href="${href("annonces/index.html")}">Annonces</a>
            <a href="${href("labo/memo.html")}">Lab</a>
          </nav>
        </div>
        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mainMenu">
          <span class="sr-only">Ouvrir le menu</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/></svg>
        </button>
        <div class="nav-right">
          <a href="${href("connect/index.html")}">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4.42 0-8 2-8 4.5V21h16v-2.5C20 16 16.42 14 12 14z"/></svg>
            <span>Connexion</span>
          </a>
          <a class="btn-primary" href="${href("submit/submitindex.html")}"><span aria-hidden="true">+</span><span>Inscription</span></a>
        </div>
      </header>`;

    const nav = host.querySelector(".nav");
    const toggle = host.querySelector(".menu-toggle");
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("menu-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    host.querySelectorAll(".menu a").forEach((link) => link.addEventListener("click", () => {
      nav.classList.remove("menu-open");
      toggle.setAttribute("aria-expanded", "false");
    }));
  });
})();
