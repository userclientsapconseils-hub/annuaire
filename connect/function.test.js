const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function createPage(ApiClient) {
  const store = new Map();
  const context = {
    ApiClient,
    console,
    Date,
    document: {
      cookie: "",
      addEventListener: () => {}
    },
    localStorage: {
      getItem: (key) => store.get(key) || null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key)
    },
    window: {
      location: { href: "" }
    }
  };

  vm.runInNewContext(fs.readFileSync(`${__dirname}/function.js`, "utf8"), context);
  return { context, store };
}

function createGuest(accountType) {
  return {
    mail: "same@example.fr",
    password: "secret",
    accountType,
    token: "",
    message: { textContent: "", className: "" }
  };
}

(async () => {
  {
    const { context, store } = createPage({
      login: async () => "token-pro",
      getUserAccountType: async (_token, _mail, preferredType) => preferredType
    });
    const guest = createGuest("pro");

    await context.checkGuest(guest);

    assert.equal(guest.token, "token-pro");
    assert.equal(store.get("accountType"), "pro");
    assert.equal(JSON.parse(store.get("authSession")).accountType, "pro");
  }

  {
    const { context, store } = createPage({
      login: async () => "token-pro",
      getUserAccountType: async () => "pro"
    });
    const guest = createGuest("customer");

    await assert.rejects(() => context.checkGuest(guest), (error) => error === "id");
    assert.equal(guest.token, "");
    assert.equal(store.has("authSession"), false);
    assert.equal(store.has("token"), false);
  }

  console.log("Tests de session de connexion réussis.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
