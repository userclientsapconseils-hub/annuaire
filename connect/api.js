(function (global) {
  const API_URL = "https://de3qg7ntqblkinxmxfhqoisuhi0pckix.lambda-url.eu-west-3.on.aws/";

  async function post(body) {
    const response = await axios.post(API_URL, body, {
      headers: { "Content-Type": "application/json" }
    });

    return response?.data?.data;
  }

  function normalizeAccountType(type) {
    const value = String(type || "").trim().toLowerCase();
    if (value === "customer" || value === "particulier") return "customer";
    if (value === "pro" || value === "professional" || value === "professionnel") return "pro";
    return "";
  }

  function normalizeTokenString(value) {
    const token = String(value || "").trim();
    const rejectedValues = new Set(["false", "null", "undefined", "not connected", "not found", "unauthorized"]);
    if (token.length < 8) return null;
    if (/\s/.test(token)) return null;
    if (rejectedValues.has(token.toLowerCase())) return null;
    return token;
  }

  async function requestLoginToken(email, password, type = "") {
    const data = { mail: email, password: password };
    const normalizedType = normalizeAccountType(type);
    if (normalizedType) data.type = normalizedType;

    const response = await axios.post(API_URL, {
      request: "token",
      collection: "user",
      data
    }, {
      headers: { "Content-Type": "application/json" }
    });

    return extractToken(response?.data);
  }

  async function login(email, password, accountType = "") {
    const normalizedType = normalizeAccountType(accountType);

    // Le backend a connu deux contrats de connexion :
    // - comptes récents : mail + mot de passe + type ;
    // - comptes historiques : mail + mot de passe uniquement.
    // On essaie donc le contrat typé en priorité, puis le contrat legacy.
    if (normalizedType) {
      try {
        const typedToken = await requestLoginToken(email, password, normalizedType);
        if (typedToken) return typedToken;
      } catch (error) {
        // Un refus d'authentification sur le contrat typé ne doit pas empêcher
        // le fallback legacy. Les autres erreurs seront réémises seulement si
        // le fallback échoue également.
        try {
          const legacyToken = await requestLoginToken(email, password);
          if (legacyToken) return legacyToken;
        } catch (legacyError) {
          throw legacyError?.response ? legacyError : error;
        }
        return null;
      }
    }

    return requestLoginToken(email, password);
  }

  function extractToken(payload) {
    if (!payload) return null;
    if (typeof payload === "string") {
      try {
        return extractToken(JSON.parse(payload));
      } catch {
        return normalizeTokenString(payload);
      }
    }
    if (Array.isArray(payload)) {
      for (const item of payload) {
        const token = extractToken(item);
        if (token) return token;
      }
      return null;
    }
    if (typeof payload !== "object") return null;
    if (typeof payload.token === "string") return normalizeTokenString(payload.token);
    return extractToken(payload.data) || extractToken(payload.body);
  }

  function extractUsers(payload) {
    if (typeof payload === "string") {
      try {
        return extractUsers(JSON.parse(payload));
      } catch {
        return [];
      }
    }
    if (Array.isArray(payload)) return payload.flatMap(extractUsers);
    if (!payload || typeof payload !== "object") return [];

    const users = ("mail" in payload || "type" in payload) ? [payload] : [];
    return users.concat(
      ["data", "body", "items", "Items", "records", "results"]
        .flatMap((key) => key in payload ? extractUsers(payload[key]) : [])
    );
  }

  function getStoredAccountType() {
    try {
      return normalizeAccountType(global?.localStorage?.getItem("accountType"));
    } catch {
      return "";
    }
  }

  async function getUserAccountType(token, userEmail, preferredType = "") {
    const normalizedEmail = String(userEmail || "").trim().toLowerCase();
    if (!token || !normalizedEmail) return null;

    const payload = await findUserByMail(token, normalizedEmail);
    const users = extractUsers(payload);
    const matchingUsers = users.filter(
      (candidate) => String(candidate.mail || "").trim().toLowerCase() === normalizedEmail
    );
    const candidates = matchingUsers.length
      ? matchingUsers
      : (users.length === 1 ? users : []);
    if (!candidates.length) return null;

    const expectedType = normalizeAccountType(preferredType) || getStoredAccountType();
    if (expectedType) {
      const exactMatches = candidates.filter(
        (candidate) => normalizeAccountType(candidate.type) === expectedType
      );
      if (exactMatches.length === 1) return expectedType;

      if (expectedType === "pro") {
        const legacyMatches = candidates.filter(
          (candidate) => !String(candidate.type || "").trim()
        );
        if (legacyMatches.length === 1 && exactMatches.length === 0) return "pro";
      }

      return null;
    }

    if (candidates.length !== 1) return null;
    const type = normalizeAccountType(candidates[0].type);
    if (type) return type;

    return "pro";
  }

  async function validateUserSession(token, userEmail) {
    if (!token || !userEmail) return "invalid";

    try {
      const payload = await post({
        request: "find",
        collection: "user",
        token: token,
        data: { mail: userEmail }
      });

      const normalizedEmail = String(userEmail).trim().toLowerCase();
      const matchingUser = extractUsers(payload).some(
        (user) => String(user.mail || "").trim().toLowerCase() === normalizedEmail
      );
      return matchingUser ? "valid" : "invalid";
    } catch (error) {
      console.warn("Impossible de verifier la session pour le moment.");
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return "invalid";
      }
      return "unknown";
    }
  }

  async function findUserByMail(token, mail) {
    return post({ request: "find", collection: "user", token, data: { mail } });
  }

  async function registerUser(email, password, type = "pro") {
    const apiType = type === "particulier" ? "customer" : type;

    return post({
      request: "insert",
      collection: "user",
      data: {
        mail: email,
        password: password,
        type: apiType
      }
    });
  }

  async function saveOffer(token, data, isUpdate) {
    return post({
      request: isUpdate ? "update" : "insert",
      collection: "publicOffer",
      token,
      data
    });
  }

  async function findOffers(data = {}, token = "") {
    const body = {
      request: "find",
      collection: "publicOffer",
      data
    };

    if (token) {
      body.token = token;
    }

    return post(body);
  }

  async function findOfferByMail(token, mail) {
    return post({
      request: "find",
      collection: "publicOffer",
      token,
      data: { mail }
    });
  }

  async function createQuoteRequest(data) {
    return post({ request: "insert", collection: "quoterequest", data });
  }

  async function findQuoteRequests(token, professionalMail) {
    return post({
      request: "find",
      collection: "quoterequest",
      token,
      data: { professionalMail }
    });
  }

  async function findCustomerQuoteRequests(token, customerEmail) {
    return post({
      request: "find",
      collection: "quoterequest",
      token,
      data: { customerEmail }
    });
  }

  async function updateQuoteRequestStatus(token, quoteRequest, status) {
    return post({
      request: "update",
      collection: "quoterequest",
      token,
      data: { ...quoteRequest, status, updatedAt: new Date().toISOString() }
    });
  }

  global.ApiClient = {
    login,
    getUserAccountType,
    validateUserSession,
    findUserByMail,
    registerUser,
    saveOffer,
    findOffers,
    findOfferByMail,
    createQuoteRequest,
    findQuoteRequests,
    findCustomerQuoteRequests,
    updateQuoteRequestStatus
  };
})(window);
