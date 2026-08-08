const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function createClient(apiPayloads) {
  const payloads = [...apiPayloads];
  const requests = [];
  const window = {};
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
  assert.equal(
    await createClient([[
      { mail: "same@example.fr", type: "pro" },
      { mail: "same@example.fr", type: "customer" }
    ]]).client.getUserAccountType("token", "same@example.fr"),
    null
  );

  console.log("Tests du client d'authentification réussis.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
