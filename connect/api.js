(function (global) {
  const API_URL = "https://de3qg7ntqblkinxmxfhqoisuhi0pckix.lambda-url.eu-west-3.on.aws/";

  async function post(body) {
    const response = await axios.post(API_URL, body, {
      headers: { "Content-Type": "application/json" }
    });

    return response?.data?.data;
  }

  async function login(email, password) {
    const payload = await post({
      request: "token",
      collection: "user",
      data: {
        mail: email,
        password: password
      }
    });

    if (!payload) return null;

    if (typeof payload === "string") {
      try {
        const parsed = JSON.parse(payload);
        return parsed?.token || null;
      } catch {
        return payload;
      }
    }

    if (typeof payload === "object") {
      return payload?.token || null;
    }

    return null;
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

      if (payload === null || payload === undefined) return "invalid";
      if (Array.isArray(payload)) return payload.length > 0 ? "valid" : "invalid";

      if (typeof payload === "string") {
        try {
          const parsed = JSON.parse(payload);
          if (Array.isArray(parsed)) return parsed.length > 0 ? "valid" : "invalid";
          if (parsed && typeof parsed === "object") return Object.keys(parsed).length > 0 ? "valid" : "invalid";
          return "invalid";
        } catch {
          return payload.trim() !== "" ? "valid" : "invalid";
        }
      }

      if (typeof payload === "object") return Object.keys(payload).length > 0 ? "valid" : "invalid";

      return "unknown";
    } catch (error) {
      console.error("Impossible de vérifier la session pour le moment :", error);
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return "invalid";
      }
      return "unknown";
    }
  }



  async function registerUser(email, password, type = "pro") {
    return post({
      request: "insert",
      collection: "user",
      data: {
        mail: email,
        password: password,
        type
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

  async function findOfferByMail(token, mail) {
    return post({
      request: "find",
      collection: "publicOffer",
      token,
      data: { mail }
    });
  }

  global.ApiClient = {
    login,
    validateUserSession,
    registerUser,
    saveOffer,
    findOfferByMail
  };
})(window);
