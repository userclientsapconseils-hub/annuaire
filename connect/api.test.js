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
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response;
    }
  };
  vm.runInNewContext(fs.readFileSync(`${__dirname}/api.js`, "utf8"), { window, axios, console });
  return { client: window.ApiClient, requests };
}

function wrappedData(payload) {
  return { data: { data: payload } };
}

function httpError(status) {
  const error = new Error(`HTTP ${status}`);
  error.response = { status };
  return error;
}

(async () => {
  assert.equal(await createClient([{ data: { token: "token-top" } }]).client.login("pro@example.fr", "secret"), "token-top");
  assert.equal(await createClient([{ data: { token: 98765432101 } }]).client.login("pro@example.fr", "secret"), "98765432101");
  assert.equal(await createClient([wrappedData("token-simple")]).client.login("pro@example.fr", "secret"), "token-simple");
  assert.equal(await createClient([wrappedData(123456789012)]).client.login("pro@example.fr", "secret"), "123456789012");
  assert.equal(await createClient([wrappedData('{"token":"token-json"}')]).client.login("pro@example.fr", "secret"), "token-json");
  assert.equal(await createClient([wrappedData({ data: { token: "token-nested" } })]).client.login("pro@example.fr", "secret"), "token-nested");
  assert.equal(await createClient([{ data: { body: { token: "token-body" } } }]).client.login("pro@example.fr", "secret"), "token-body");
  assert.equal(await createClient([wrappedData([{ token: "token-array" }])]).client.login("pro@example.fr", "secret"), "token-array");
  assert.equal(await createClient([wrappedData("not connected")]).client.login("pro@example.fr", "secret"), null);
  assert.equal(await createClient([wrappedData("false")]).client.login("pro@example.fr", "secret"), null);

  const sensitiveError = new Error("backend leaked sensitive content");
  sensitiveError.response = { status: 500, data: { token: "leaked-token", password: "leaked-password" } };
  await assert.rejects(
    () => createClient([sensitiveError]).client.login("pro@example.fr", "secret"),
    (error) => error.message === "api request failed" && error.response?.status === 500 && !("data" in error.response)
  );

  const professionalLogin = createClient([wrappedData("token-pro")]);
  assert.equal(await professionalLogin.client.login("same@example.fr", "pro-password", "pro"), "token-pro");
  assert.equal(professionalLogin.requests.length, 1);
  assert.equal(professionalLogin.requests[0].request, "token");
  assert.equal(professionalLogin.requests[0].collection, "user");
  assert.equal(professionalLogin.requests[0].data.mail, "same@example.fr");
  assert.equal(professionalLogin.requests[0].data.password, "pro-password");
  assert.equal(professionalLogin.requests[0].data.type, "pro");

  const customerLogin = createClient([wrappedData("token-customer")]);
  assert.equal(await customerLogin.client.login("same@example.fr", "customer-password", "customer"), "token-customer");
  assert.equal(customerLogin.requests.length, 1);
  assert.equal(customerLogin.requests[0].data.type, "customer");

  const particulierAliasLogin = createClient([wrappedData("token-particulier")]);
  assert.equal(await particulierAliasLogin.client.login("client@example.fr", "secret", "particulier"), "token-particulier");
  assert.equal(particulierAliasLogin.requests[0].data.type, "customer");

  const legacyFallbackAfterEmpty = createClient([
    wrappedData(null),
    wrappedData("legacy-token"),
    wrappedData([{ mail: "legacy@example.fr" }])
  ]);
  assert.equal(await legacyFallbackAfterEmpty.client.login("legacy@example.fr", "legacy-password", "pro"), "legacy-token");
  assert.equal(legacyFallbackAfterEmpty.requests.length, 3);
  assert.equal(legacyFallbackAfterEmpty.requests[0].data.type, "pro");
  assert.equal("type" in legacyFallbackAfterEmpty.requests[1].data, false);
  assert.equal(legacyFallbackAfterEmpty.requests[2].request, "find");

  const legacyFallbackAfter401 = createClient([
    httpError(401),
    wrappedData("legacy-token-after-401"),
    wrappedData([{ mail: "legacy@example.fr" }])
  ]);
  assert.equal(await legacyFallbackAfter401.client.login("legacy@example.fr", "legacy-password", "pro"), "legacy-token-after-401");
  assert.equal(legacyFallbackAfter401.requests.length, 3);
  assert.equal(legacyFallbackAfter401.requests[0].data.type, "pro");
  assert.equal("type" in legacyFallbackAfter401.requests[1].data, false);

  const customerLegacyFallback = createClient([
    wrappedData(null),
    wrappedData("customer-legacy-token"),
    wrappedData([{ mail: "client@example.fr", type: "customer" }])
  ]);
  assert.equal(await customerLegacyFallback.client.login("client@example.fr", "legacy-password", "customer"), "customer-legacy-token");
  assert.equal(customerLegacyFallback.requests[0].data.type, "customer");
  assert.equal("type" in customerLegacyFallback.requests[1].data, false);

  const ambiguousLegacyFallback = createClient([
    httpError(301),
    wrappedData("ambiguous-token"),
    wrappedData([
      { mail: "duplicate@example.fr", type: "pro" },
      { mail: "duplicate@example.fr", type: "customer" }
    ])
  ]);
  assert.equal(
    await ambiguousLegacyFallback.client.login("duplicate@example.fr", "customer-password", "pro"),
    null
  );

  const lambdaNotFoundResponse = createClient([
    httpError(301),
    httpError(301)
  ]);
  assert.equal(
    await lambdaNotFoundResponse.client.login("absent@example.fr", "wrong-password", "customer"),
    null
  );
  assert.equal(lambdaNotFoundResponse.requests.length, 2);

  const professionalRegistration = createClient([wrappedData({ inserted: true })]);
  await professionalRegistration.client.registerUser("NOUVEAU-PRO@EXAMPLE.FR", "secret-pro", "pro");
  assert.equal(professionalRegistration.requests[0].request, "insert");
  assert.equal(professionalRegistration.requests[0].collection, "user");
  assert.equal(professionalRegistration.requests[0].data.mail, "nouveau-pro@example.fr");
  assert.equal(professionalRegistration.requests[0].data.password, "secret-pro");
  assert.equal(professionalRegistration.requests[0].data.type, "pro");

  const customerRegistration = createClient([wrappedData({ inserted: true })]);
  await customerRegistration.client.registerUser("nouveau-client@example.fr", "secret-client", "customer");
  assert.equal(customerRegistration.requests[0].request, "insert");
  assert.equal(customerRegistration.requests[0].collection, "user");
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
    null
  );
  assert.equal(
    await createClient([wrappedData(duplicateAccounts)], "customer").client.getUserAccountType("token", "same@example.fr"),
    null
  );
  assert.equal(
    await createClient([wrappedData(duplicateAccounts)]).client.getUserAccountType("token", "same@example.fr", "pro"),
    null
  );
  assert.equal(
    await createClient([wrappedData(duplicateAccounts)]).client.getUserAccountType("token", "same@example.fr", "particulier"),
    null
  );

  const legacyProAndCustomer = [
    { mail: "legacy-same@example.fr" },
    { mail: "legacy-same@example.fr", type: "customer" }
  ];
  assert.equal(
    await createClient([wrappedData(legacyProAndCustomer)]).client.getUserAccountType("token", "legacy-same@example.fr", "pro"),
    null
  );
  assert.equal(
    await createClient([wrappedData(legacyProAndCustomer)]).client.getUserAccountType("token", "legacy-same@example.fr", "customer"),
    null
  );

  const wrongSelectedType = [{ mail: "pro-only@example.fr", type: "pro" }];
  assert.equal(
    await createClient([wrappedData(wrongSelectedType)]).client.getUserAccountType("token", "pro-only@example.fr", "customer"),
    "pro"
  );

  const quoteCreation = createClient([wrappedData({ inserted: true })]);
  await quoteCreation.client.createQuoteRequest("customer-token", {
    requestId: "request-123",
    share: 42,
    customerEmail: "client@example.fr",
    status: "forged-status"
  });
  assert.equal(quoteCreation.requests[0].token, "customer-token");
  assert.equal(quoteCreation.requests[0].request, "insert");
  assert.equal(quoteCreation.requests[0].collection, "privateAsk");
  assert.equal(quoteCreation.requests[0].data.requestId, "request-123");
  assert.equal(quoteCreation.requests[0].data.share, 42);
  assert.equal(quoteCreation.requests[0].data.professionalUserNumber, 42);
  assert.equal(quoteCreation.requests[0].data.status, "pending");
  await assert.rejects(
    () => createClient([]).client.createQuoteRequest("", { requestId: "request-123", share: 42 }),
    /authentication required/
  );
  await assert.rejects(
    () => createClient([]).client.createQuoteRequest("customer-token", { requestId: "request-123" }),
    /invalid quote request/
  );

  const quoteRequestSearch = createClient([wrappedData([])]);
  await quoteRequestSearch.client.findQuoteRequests("professional-token");
  assert.equal(quoteRequestSearch.requests[0].request, "find");
  assert.equal(quoteRequestSearch.requests[0].collection, "privateAsk");
  assert.equal(Object.keys(quoteRequestSearch.requests[0].data).length, 0);

  const quoteResponseSearch = createClient([wrappedData([])]);
  await quoteResponseSearch.client.findQuoteResponses("customer-token");
  assert.equal(quoteResponseSearch.requests[0].request, "find");
  assert.equal(quoteResponseSearch.requests[0].collection, "privateQuote");
  assert.equal(Object.keys(quoteResponseSearch.requests[0].data).length, 0);

  const quoteResponseCreation = createClient([wrappedData({ inserted: true })]);
  await quoteResponseCreation.client.createQuoteResponse("professional-token", {
    id: "mongo-document-id",
    requestId: "request-123",
    userNumber: 84,
    professionalName: "Entreprise de test"
  }, "validated");
  assert.equal(quoteResponseCreation.requests[0].request, "insert");
  assert.equal(quoteResponseCreation.requests[0].collection, "privateQuote");
  assert.equal(quoteResponseCreation.requests[0].data.share, 84);
  assert.equal(quoteResponseCreation.requests[0].data.requestId, "request-123");
  assert.equal(quoteResponseCreation.requests[0].data.requestDocumentId, "mongo-document-id");
  assert.equal(quoteResponseCreation.requests[0].data.status, "validated");
  assert.ok(!Number.isNaN(Date.parse(quoteResponseCreation.requests[0].data.respondedAt)));
  await assert.rejects(
    () => createClient([]).client.createQuoteResponse("professional-token", { requestId: "request-123", userNumber: 84 }, "pending"),
    /invalid quote response/
  );
  await assert.rejects(
    () => createClient([]).client.createQuoteResponse("professional-token", { requestId: "request-123" }, "validated"),
    /invalid quote response/
  );

  console.log("Tests d'authentification et de demandes de devis réussis.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

