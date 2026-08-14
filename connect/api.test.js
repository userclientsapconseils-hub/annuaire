const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function createClient(apiPayloads, storedAccountType = "") {
  const payloads = [...apiPayloads];
  const requests = [];
  const window = {
    localStorage: {
      getItem: (key) => key === "accountType" ? storedAccountType : null
    }
  };
  const axios = {
    post: async (_url, body) => {
      requests.push(body);
      return { data: { data: payloads.shift() } };
    }
  };
  vm.runInNewContext(fs.readFileSync(`${__dirname}/api.js`, "utf8"), { window, axios, console });
  return { client: window.ApiClient, requests };
}

(async () => {
  assert.equal(await createClient(["token-simple"]).client.login("pro@example.fr", "secret"), "token-simple");
  assert.equal(await createClient(['{"token":"token-json"}']).client.login("pro@example.fr", "secret"), "token-json");
  assert.equal(await createClient([{ data: { token: "token-nested" } }]).client.login("pro@example.fr", "secret"), "token-nested");

  const professionalLogin = createClient(["token-pro"]);
  assert.equal(await professionalLogin.client.login("same@example.fr", "pro-password", "pro"), "token-pro");
  assert.equal(professionalLogin.requests[0].data.mail, "same@example.fr");
  assert.equal(professionalLogin.requests[0].data.password, "pro-password");
  assert.equal("type" in professionalLogin.requests[0].data, false);

  const customerLogin = createClient(["token-customer"]);
  assert.equal(await customerLogin.client.login("same@example.fr", "customer-password", "customer"), "token-customer");
  assert.equal(customerLogin.requests[0].data.mail, "same@example.fr");
  assert.equal(customerLogin.requests[0].data.password, "customer-password");
  assert.equal("type" in customerLogin.requests[0].data, false);

  const professionalRegistration = createClient([{ inserted: true }]);
  await professionalRegistration.client.registerUser("nouveau-pro@example.fr", "secret-pro", "pro");
  assert.equal(professionalRegistration.requests[0].request, "insert");
  assert.equal(professionalRegistration.requests[0].collection, "user");
  assert.equal(professionalRegistration.requests[0].data.mail, "nouveau-pro@example.fr");
  assert.equal(professionalRegistration.requests[0].data.password, "secret-pro");
  assert.equal(professionalRegistration.requests[0].data.type, "pro");

  const customerRegistration = createClient([{ inserted: true }]);
  await customerRegistration.client.registerUser("nouveau-client@example.fr", "secret-client", "customer");
  assert.equal(customerRegistration.requests[0].request, "insert");
  assert.equal(customerRegistration.requests[0].collection, "user");
  assert.equal(customerRegistration.requests[0].data.mail, "nouveau-client@example.fr");
  assert.equal(customerRegistration.requests[0].data.password, "secret-client");
  assert.equal(customerRegistration.requests[0].data.type, "customer");

  const particulierAliasRegistration = createClient([{ inserted: true }]);
  await particulierAliasRegistration.client.registerUser("alias-client@example.fr", "secret-client", "particulier");
  assert.equal(particulierAliasRegistration.requests[0].data.type, "customer");

  assert.equal(
    await createClient([[{ mail: "CLIENT@EXAMPLE.FR", type: "particulier" }]]).client
      .getUserAccountType("token", "client@example.fr"),
    "customer"
  );
  assert.equal(
    await createClient([[{ type: "pro" }]]).client.getUserAccountType("token", "pro@example.fr"),
    "pro"
  );
  assert.equal(
    await createClient([[{ mail: "legacy@example.fr" }]]).client.getUserAccountType("token", "legacy@example.fr"),
    "pro"
  );

  const duplicateAccounts = [
    { mail: "same@example.fr", type: "pro" },
    { mail: "same@example.fr", type: "customer" }
  ];

  assert.equal(
    await createClient([duplicateAccounts]).client.getUserAccountType("token", "same@example.fr"),
    null
  );
  assert.equal(
    await createClient([duplicateAccounts], "pro").client.getUserAccountType("token", "same@example.fr"),
    "pro"
  );
  assert.equal(
    await createClient([duplicateAccounts], "customer").client.getUserAccountType("token", "same@example.fr"),
    "customer"
  );
  assert.equal(
    await createClient([duplicateAccounts]).client.getUserAccountType("token", "same@example.fr", "particulier"),
    "customer"
  );

  const legacyProAndCustomer = [
    { mail: "legacy-same@example.fr" },
    { mail: "legacy-same@example.fr", type: "customer" }
  ];
  assert.equal(
    await createClient([legacyProAndCustomer], "pro").client.getUserAccountType("token", "legacy-same@example.fr"),
    "pro"
  );
  assert.equal(
    await createClient([legacyProAndCustomer], "customer").client.getUserAccountType("token", "legacy-same@example.fr"),
    "customer"
  );

  const wrongSelectedType = [{ mail: "pro-only@example.fr", type: "pro" }];
  assert.equal(
    await createClient([wrongSelectedType], "customer").client.getUserAccountType("token", "pro-only@example.fr"),
    null
  );

  console.log("Tests du client d'authentification réussis.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
