const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function eventTarget(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    listeners,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    dispatch(type, event = {}) {
      listeners.get(type)?.(event);
    }
  };
}

function classList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    contains: (name) => values.has(name),
    toggle(name, force) {
      const enabled = force === undefined ? !values.has(name) : Boolean(force);
      if (enabled) values.add(name); else values.delete(name);
      return enabled;
    }
  };
}

function createPage(session, path = "/annuaire/index.html", includeSessionManager = true) {
  const documentListeners = new Map();
  const windowListeners = new Map();
  const nav = { classList: classList() };
  const label = { textContent: "" };
  const toggle = eventTarget({
    attributes: {},
    focused: false,
    setAttribute(name, value) { this.attributes[name] = value; },
    querySelector: (selector) => selector === ".sr-only" ? label : null,
    focus() { this.focused = true; }
  });
  let logout = null;
  let links = [];
  const host = {
    dataset: {},
    classList: classList(),
    html: "",
    set innerHTML(value) {
      this.html = value;
      logout = value.includes("data-logout") ? eventTarget() : null;
      links = [...value.matchAll(/<a[^>]+href="([^"]+)"/g)].map((match) => ({
        href: match[1],
        attributes: {},
        setAttribute(name, attributeValue) { this.attributes[name] = attributeValue; },
        addEventListener() {}
      }));
    },
    get innerHTML() { return this.html; },
    querySelector(selector) {
      if (selector === ".nav") return nav;
      if (selector === ".menu-toggle") return toggle;
      if (selector === "[data-logout]") return logout;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "a[href]") return links;
      if (selector === ".menu a") return [];
      return [];
    },
    contains(target) { return target === this; }
  };

  let cleared = false;
  let replacedWith = "";
  const document = {
    currentScript: { src: "https://example.test/annuaire/home/navigation.js" },
    baseURI: `https://example.test${path}`,
    querySelectorAll: (selector) => selector === "[data-site-header]" ? [host] : [],
    addEventListener: (type, listener) => documentListeners.set(type, listener)
  };
  const window = {
    innerWidth: 390,
    location: {
      href: `https://example.test${path}`,
      replace(value) { replacedWith = value; }
    },
    addEventListener: (type, listener) => windowListeners.set(type, listener)
  };

  if (includeSessionManager) {
    window.AuthSession = {
      get: () => session,
      normalizeAccountType(type) {
        if (type === "pro") return "pro";
        if (type === "customer" || type === "particulier") return "customer";
        return "";
      },
      clear() { cleared = true; }
    };
  }

  vm.runInNewContext(
    fs.readFileSync(`${__dirname}/navigation.js`, "utf8"),
    { window, document, URL, console }
  );

  return {
    host,
    nav,
    toggle,
    label,
    logout,
    links,
    documentListeners,
    windowListeners,
    wasCleared: () => cleared,
    replacedWith: () => replacedWith
  };
}

(() => {
  const guest = createPage(null, "/annuaire/services/index.html");
  assert.match(guest.host.html, />Accueil</);
  assert.match(guest.host.html, />Services</);
  assert.match(guest.host.html, />Connexion</);
  assert.match(guest.host.html, />Inscription</);
  assert.doesNotMatch(guest.host.html, /Mon espace|Déconnexion/);
  assert.equal(guest.links.some((link) => link.attributes["aria-current"] === "page"), true);

  const professional = createPage({ token: "pro-token", email: "pro@example.fr", accountType: "pro" });
  assert.match(professional.host.html, /espacePersonnel\/index\.html/);
  assert.match(professional.host.html, /Mon espace/);
  assert.match(professional.host.html, /Déconnexion/);
  assert.doesNotMatch(professional.host.html, />Connexion</);

  const customer = createPage({ token: "customer-token", email: "client@example.fr", accountType: "customer" });
  assert.match(customer.host.html, /espaceParticulier\/index\.html/);

  const invalidRole = createPage({ token: "token", email: "user@example.fr", accountType: "admin" });
  assert.match(invalidRole.host.html, />Connexion</);
  assert.doesNotMatch(invalidRole.host.html, /Mon espace/);

  const noSessionManager = createPage(null, "/annuaire/index.html", false);
  assert.match(noSessionManager.host.html, />Connexion</);

  professional.logout.dispatch("click");
  assert.equal(professional.wasCleared(), true);
  assert.equal(professional.replacedWith(), "https://example.test/annuaire/index.html");

  guest.toggle.dispatch("click");
  assert.equal(guest.nav.classList.contains("menu-open"), true);
  assert.equal(guest.toggle.attributes["aria-expanded"], "true");
  assert.equal(guest.label.textContent, "Fermer le menu");
  guest.documentListeners.get("keydown")({ key: "Escape" });
  assert.equal(guest.nav.classList.contains("menu-open"), false);
  assert.equal(guest.toggle.focused, true);

  console.log("Tests du menu partagé réussis.");
})();
