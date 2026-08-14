const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function createClient(apiResponses, storedAccountType = "") {
  const responses = [...apiResponses];
  const requests = [];
  const window = {
    localStorage: {
      getItem: (key) => key === "accountType" ? storedAccountType : null
    }
  };
  const axios = {
    post: async (_url, body) => {
      requests.push(body);
      return responses.shift();
    }
  };
  vm.runInNewContext(fs.readFileSync(`${__dirname}/api.js`, "utf8"), { window, axios, console });
  return { client: window.ApiClient, requests };
}

function wrappedData(payload) {
  return { data: { data: payload } };
}

(async () => {
  assert.equal(await createClient([{ data: { token: "token-top" } }]).client.login("pro@example.fr", "secret"), "token-top");
  assert.equal(await createClient([wrappedData("token-simple")]).client.login("pro@example.fr", "secret"), "token-simple");
  assert.equal(await createClient([wrappedData('{"token":"token-json"}')]).client.login("pro@example.fr", "secret"), "token-json");
  assert.equal(await createClient([wrappedData({ data: { token: "token-nested" } })]).client.login("pro@example.fr", "secret"), "token-nested");
  assert.equal(await createClient([{ data: { body: { token: "token-body" } } }]).client.login("pro@example.fr", "secret"), "token-body");

  const professionalLogin = createClient([wrappedData("token-pro")]);
  assert.equal(await professionalLogin.client.login("same@example.fr", "pro-password", "pro"), "token-pro");
  assert.equal(professionalLogin.requests[0].request, "token");
  assert.equal(professionalLogin.requests[0].collection, "user");
  assert.equal(professionalLogin.requests[0].data.mail, "same@example.fr");
  assert.equal(professionalLogin.requests[0].data.password, "pro-password");
  assert.equal("type" in professionalLogin.requests[0].data, false);

  const customerLogin = createClient([wrappedData("token-customer")]);
  assert.equal(await customerLogin.client.login("same@example.fr", "customer-password", "customer"), "token-customer");
  assert.equal(customerLogin.requests[0].data.mail, "same@example.fr");
  assert.equal(customerLogin.requests[0].data.password, "customer-password");
  assert.equal("type" in customerLogin.requests[0].data, false);

  const professionalRegistration = createClient([wrappedData({ inserted: true })]);
  await professionalRegistration.client.registerUser("nouveau-pro@example.fr", "secret-pro", "pro");
  assert.equal(professionalRegistration.requests[0].request, "insert");
  assert.equal(professionalRegistration.requests[0].collection, "user");
  assert.equal(professionalRegistration.requests[0].data.mail, "nouveau-pro@example.fr");
  assert.equal(professionalRegistration.requests[0].data.password, "secret-pro");
  assert.equal(professionalRegistration.requests[0].data.type, "pro");

  const customerRegistration = createClient([wrappedData({ inserted: true })]);
  await customerRegistration.client.registerUser("nouveau-client@example.fr", "secret-client", "customer");
  assert.equal(customerRegistration.requests[0].request, "insert");
  assert.equal(customerRegistration.requests[0].collection, "user");
  assert.equal(customerRegistration.requests[0].data.mail, "nouveau-client@example.fr");
  assert.equal(customerRegistration.requests[0].data.password, "secret-client");
  assert.equal(customerRegistration.requests[0].data.type, "customer");

  const particulierAliasRegistration = createClient([wrappedData({ inserted: true })]);
  await particulierAliasRegistration.client.registerUser("alias-client@example.fr", "secret-client", "particulier");
  assert.equal(particulierAliasRegistration.requests[0].data.type, "customer");

  assert.equal(
    await createClient([wrappedData([{ mail: "CLIENT@EXAMPLE.FR", type: "particulier" }])]).client
      .getUserAccountType("token", "client@example.fr"),
    "customer"
  );
  assert.equal(
    await createClient([wrappedData([{ type: "pro" }])]).client.getUserAccountType("token", "pro@example.fr"),
    "pro"
  );
  assert.equal(
    await createClient([wrappedData([{ mail: "legacy@example.fr" }])]).client.getUserAccountType("token", "legacy@example.fr"),
    "pro"
  );

  const duplicateAccounts = [
    { mail: "same@example.fr", type: "pro" },
    { mail: "same@example.fr", type: "customer" }
  ];

  assert.equal(
    await createClient([wrappedData(duplicateAccounts)]).client.getUserAccountType("token", "same@example.fr"),
    null
  );
  assert.equal(
    await createClient([wrappedData(duplicateAccounts)], "pro").client.getUserAccountType("token", "same@example.fr"),
    "pro"
  );
  assert.equal(
    await createClient([wrappedData(duplicateAccounts)], "customer").client.getUserAccountType("token", "same@example.fr"),
    "customer"
  );
  assert.equal(
    await createClient([wrappedData(duplicateAccounts)]).client.getUserAccountType("token", "same@example.fr", "particulier"),
    "customer"
  );

  const legacyProAndCustomer = [
    { mail: "legacy-same@example.fr" },
    { mail: "legacy-same@example.fr", type: "customer" }
  ];
  assert.equal(
    await createClient([wrappedData(legacyProAndCustomer)], "pro").client.getUserAccountType("token", "legacy-same@example.fr"),
    "pro"
  );
  assert.equal(
    await createClient([wrappedData(legacyProAndCustomer)], "customer").client.getUserAccountType("token", "legacy-same@example.fr"),
    "customer"
  );

  const wrongSelectedType = [{ mail: "pro-only@example.fr", type: "pro" }];
  assert.equal(
    await createClient([wrappedData(wrongSelectedType)], "customer").client.getUserAccountType("token", "pro-only@example.fr"),
    null
  );

  console.log("Tests du client d'authentification réussis.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
