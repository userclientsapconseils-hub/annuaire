(function (global) {
  const API_URL = "https://de3qg7ntqblkinxmxfhqoisuhi0pckix.lambda-url.eu-west-3.on.aws/";

  async function post(body) {
    const response = await apiPost(body);

    return response?.data?.data;
  }

  async function apiPost(body) {
    try {
      return await axios.post(API_URL, body, {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      throw sanitizeApiError(error);
    }
  }

  function sanitizeApiError(error) {
    const safeError = new Error("api request failed");
    if (error?.response?.status) {
      safeError.response = { status: error.response.status };
    }
    return safeError;
  }

  function isAuthenticationRejection(error) {
    return [301, 401, 403, 404].includes(Number(error?.response?.status));
  }

  function normalizeAccountType(type) {
    const value = String(type || "").trim().toLowerCase();
    if (value === "customer" || value === "particulier") return "customer";
    if (value === "pro" || value === "professional" || value === "professionnel") return "pro";
    return "";
  }

  function normalizeTokenString(value) {
    if (typeof value === "number" && (!Number.isSafeInteger(value) || value <= 0)) {
      return null;
    }
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

    try {
      const response = await apiPost({
        request: "token",
        collection: "user",
        data
      });

      return extractToken(response?.data);
    } catch (error) {
      // Cette Lambda utilise historiquement 301 pour « aucun résultat ».
      // Sans ce traitement, de mauvais identifiants sont affichés comme une
      // panne serveur et le fallback des comptes historiques ne fonctionne pas.
      if (isAuthenticationRejection(error)) return null;
      throw error;
    }
  }

  async function login(email, password, accountType = "") {
    const normalizedType = normalizeAccountType(accountType);
    const normalizedEmail = String(email || "").trim();
    if (!normalizedEmail || !password) return null;

    // Le backend a connu deux contrats de connexion :
    // - comptes récents : mail + mot de passe + type ;
    // - comptes historiques : mail + mot de passe uniquement.
    // On essaie donc le contrat typé en priorité, puis le contrat legacy.
    if (normalizedType) {
      const typedToken = await requestLoginToken(normalizedEmail, password, normalizedType);
      if (typedToken) return typedToken;

      const legacyToken = await requestLoginToken(normalizedEmail, password);
      if (!legacyToken) return null;

      // Un fallback sans rôle n'est sûr que si l'adresse correspond à un seul
      // rôle vérifiable. Une adresse dupliquée reste volontairement ambiguë.
      const legacyAccountType = await getUserAccountType(legacyToken, normalizedEmail);
      return legacyAccountType === normalizedType ? legacyToken : null;
    }

    return requestLoginToken(normalizedEmail, password);
  }

  function extractToken(payload) {
    if (!payload) return null;
    if (typeof payload === "number") return normalizeTokenString(payload);
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
    if (typeof payload.token === "string" || typeof payload.token === "number") {
      return normalizeTokenString(payload.token);
    }
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

  async function getUserAccountType(token, userEmail) {
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

    // Une adresse correspondant à plusieurs comptes est ambiguë. Le navigateur
    // ne doit jamais choisir lui-même le rôle à utiliser.
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
    const apiType = normalizeAccountType(type);
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!apiType || !normalizedEmail || !password) {
      throw new Error("invalid registration data");
    }

    return post({
      request: "insert",
      collection: "user",
      data: {
        mail: normalizedEmail,
        password: password,
        type: apiType
      }
    });
  }

  async function saveOffer(token, data, isUpdate) {
    if (!token) throw new Error("authentication required");
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
    if (!token) throw new Error("authentication required");
    return post({
      request: "find",
      collection: "publicOffer",
      token,
      data: { mail }
    });
  }

  async function createQuoteRequest(token, data) {
    if (!token) throw new Error("authentication required");
    const professionalUserNumber = Number(data?.share || data?.professionalUserNumber);
    const requestId = String(data?.requestId || "").trim();
    if (!Number.isSafeInteger(professionalUserNumber) || professionalUserNumber <= 0 || !requestId) {
      throw new Error("invalid quote request");
    }

    return post({
      request: "insert",
      collection: "privateAsk",
      token,
      data: {
        ...data,
        share: professionalUserNumber,
        professionalUserNumber,
        requestId,
        status: "pending"
      }
    });
  }

  async function findQuoteRequests(token) {
    if (!token) throw new Error("authentication required");
    return post({
      request: "find",
      collection: "privateAsk",
      token,
      data: {}
    });
  }

  async function findQuoteResponses(token) {
    if (!token) throw new Error("authentication required");
    return post({
      request: "find",
      collection: "privateQuote",
      token,
      data: {}
    });
  }

  async function createQuoteResponse(token, quoteRequest, status) {
    if (!token) throw new Error("authentication required");
    const normalizedStatus = String(status || "").trim().toLowerCase();
    const customerUserNumber = Number(quoteRequest?.userNumber);
    const requestId = String(quoteRequest?.requestId || "").trim();
    if (!["validated", "rejected"].includes(normalizedStatus)
      || !Number.isSafeInteger(customerUserNumber)
      || customerUserNumber <= 0
      || !requestId) {
      throw new Error("invalid quote response");
    }

    const requestDocumentId = String(quoteRequest?.id || quoteRequest?._id || "").trim();
    return post({
      request: "insert",
      collection: "privateQuote",
      token,
      data: {
        share: customerUserNumber,
        requestId,
        requestDocumentId,
        status: normalizedStatus,
        professionalName: String(quoteRequest?.professionalName || "").trim(),
        respondedAt: new Date().toISOString()
      }
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
    findQuoteResponses,
    createQuoteResponse
  };

})(window);

