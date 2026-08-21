const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function storage(store) {
  return {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key)
  };
}

function createAuth() {
  const sessionStore = new Map();
  const legacyStore = new Map();
  const document = { cookie: "" };
  const window = {
    sessionStorage: storage(sessionStore),
    localStorage: storage(legacyStore),
    document
  };
  vm.runInNewContext(
    fs.readFileSync(`${__dirname}/session.js`, "utf8"),
    { window, document, Date, console }
  );
  return { auth: window.AuthSession, sessionStore, legacyStore, document };
}

(() => {
  {
    const { auth, sessionStore, legacyStore } = createAuth();
    legacyStore.set("token", "old-token");
    const session = auth.persist("new-token", "CLIENT@EXAMPLE.FR", "particulier");

    assert.equal(session.email, "client@example.fr");
    assert.equal(session.accountType, "customer");
    assert.equal(JSON.parse(sessionStore.get("authSession")).token, "new-token");
    assert.equal(legacyStore.has("token"), false);
    assert.equal(auth.get().token, "new-token");
  }

  {
    const { auth, sessionStore, legacyStore } = createAuth();
    legacyStore.set("authSession", JSON.stringify({
      token: "legacy-token",
      email: "legacy@example.fr",
      accountType: "pro",
      expiresAt: Date.now() + 60_000
    }));

    assert.equal(auth.get().token, "legacy-token");
    assert.equal(sessionStore.has("authSession"), true);
    assert.equal(legacyStore.has("authSession"), false);
  }

  {
    const { auth, sessionStore } = createAuth();
    sessionStore.set("authSession", JSON.stringify({
      token: "expired-token",
      email: "expired@example.fr",
      accountType: "customer",
      expiresAt: Date.now() - 1
    }));

    assert.equal(auth.get(), null);
    assert.equal(sessionStore.has("authSession"), false);
  }

  {
    const { auth } = createAuth();
    assert.throws(() => auth.persist("token", "client@example.fr", "admin"), /invalid auth session/);
    assert.equal(auth.normalizeAccountType("professionnel"), "pro");
    assert.equal(auth.normalizeAccountType("admin"), "");
  }

  {
    const { auth, sessionStore } = createAuth();
    sessionStore.set("authSession", JSON.stringify({
      token: "invalid-role-token",
      email: "client@example.fr",
      accountType: "admin"
    }));
    assert.equal(auth.get(), null);
    assert.equal(sessionStore.has("authSession"), false);
  }

  {
    const { auth, sessionStore, legacyStore } = createAuth();
    legacyStore.set("authSession", JSON.stringify({
      token: "legacy-pro-token",
      email: "legacy-pro@example.fr"
    }));
    assert.equal(auth.get().accountType, "pro");
    assert.equal(sessionStore.has("authSession"), true);
  }

  console.log("Tests du stockage de session réussis.");
})();
