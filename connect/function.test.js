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

function createPage(ApiClient) {
  const sessionStore = new Map();
  const legacyStore = new Map();
  const document = {
    cookie: "",
    addEventListener: () => {},
    getElementById: () => null
  };
  const window = {
    location: { href: "" },
    sessionStorage: storage(sessionStore),
    localStorage: storage(legacyStore),
    document
  };
  const context = {
    ApiClient,
    console,
    Date,
    document,
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
    window
  };

  vm.runInNewContext(fs.readFileSync(`${__dirname}/session.js`, "utf8"), context);
  context.AuthSession = window.AuthSession;
  vm.runInNewContext(fs.readFileSync(`${__dirname}/function.js`, "utf8"), context);
  return { context, sessionStore, legacyStore };
}

function createGuest(accountType) {
  return {
    mail: "same@example.fr",
    password: "secret",
    accountType,
    token: "",
    session: null,
    message: { textContent: "", className: "" }
  };
}

(async () => {
  {
    const { context, sessionStore, legacyStore } = createPage({
      login: async () => "token-pro",
      getUserAccountType: async () => "pro"
    });
    const guest = createGuest("pro");

    await context.checkGuest(guest);

    assert.equal(guest.token, "token-pro");
    assert.equal(guest.session.accountType, "pro");
    assert.equal(JSON.parse(sessionStore.get("authSession")).accountType, "pro");
    assert.equal(legacyStore.has("authSession"), false);
    assert.equal(legacyStore.has("token"), false);
  }

  {
    const { context, sessionStore } = createPage({
      login: async () => "token-pro",
      getUserAccountType: async () => "pro"
    });
    const guest = createGuest("customer");

    await assert.rejects(() => context.checkGuest(guest), (error) => error === "id");
    assert.equal(guest.token, "");
    assert.equal(sessionStore.has("authSession"), false);
  }

  {
    const { context } = createPage({
      getUserAccountType: async () => "customer"
    });
    context.AuthSession.persist("customer-token", "client@example.fr", "customer");

    assert.equal(await context.userAlreadyConnected(), true);
    assert.equal(context.window.location.href, "../espaceParticulier/index.html");
  }

  {
    const { context, sessionStore } = createPage({
      getUserAccountType: async () => null
    });
    context.AuthSession.persist("tampered-token", "client@example.fr", "pro");

    assert.equal(await context.userAlreadyConnected(), false);
    assert.equal(sessionStore.has("authSession"), false);
    assert.equal(context.window.location.href, "");
  }

  console.log("Tests de session de connexion réussis.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
