(function (global) {
  const SESSION_KEY = "authSession";
  const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
  const LEGACY_KEYS = [SESSION_KEY, "token", "userEmail", "accountType"];

  function normalizeAccountType(type) {
    const value = String(type || "").trim().toLowerCase();
    if (value === "customer" || value === "particulier") return "customer";
    if (value === "pro" || value === "professional" || value === "professionnel") return "pro";
    return "";
  }

  function normalizeSession(value) {
    if (!value || typeof value !== "object") return null;

    const token = String(value.token || "").trim();
    const email = String(value.email || "").trim().toLowerCase();
    const accountType = normalizeAccountType(value.accountType);
    const expiresAt = Number(value.expiresAt || 0);

    if (!token || !email || !email.includes("@") || !accountType) return null;
    if (expiresAt && Date.now() >= expiresAt) return null;

    return {
      token,
      email,
      accountType,
      createdAt: Number(value.createdAt || Date.now()),
      expiresAt: expiresAt || Date.now() + SESSION_TTL_MS
    };
  }

  function read(storage, key, options = {}) {
    try {
      const raw = storage?.getItem(key);
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (options.allowLegacyPro && value && !value.accountType) value.accountType = "pro";
      return normalizeSession(value);
    } catch {
      return null;
    }
  }

  function clearLegacyStorage() {
    try {
      LEGACY_KEYS.forEach((key) => global.localStorage?.removeItem(key));
    } catch {
      // Le stockage peut être bloqué par les réglages de confidentialité.
    }
  }

  function expireLegacyCookie() {
    if (!global.document) return;
    global.document.cookie = "token=; Max-Age=0; path=/; SameSite=Lax; Secure";
    global.document.cookie = "token=; Max-Age=0; path=/annuaire; SameSite=Lax; Secure";
  }

  function persist(token, email, accountType) {
    const session = normalizeSession({
      token,
      email,
      accountType,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS
    });

    if (!session || !session.accountType) {
      throw new Error("invalid auth session");
    }

    global.sessionStorage?.setItem(SESSION_KEY, JSON.stringify(session));
    clearLegacyStorage();
    expireLegacyCookie();
    return session;
  }

  function migrateLegacySession() {
    const legacySession = read(global.localStorage, SESSION_KEY, { allowLegacyPro: true });
    let candidate = legacySession;

    if (!candidate) {
      try {
        candidate = normalizeSession({
          token: global.localStorage?.getItem("token"),
          email: global.localStorage?.getItem("userEmail"),
          accountType: global.localStorage?.getItem("accountType") || "pro"
        });
      } catch {
        candidate = null;
      }
    }

    clearLegacyStorage();
    expireLegacyCookie();

    if (!candidate) return null;
    global.sessionStorage?.setItem(SESSION_KEY, JSON.stringify(candidate));
    return candidate;
  }

  function get() {
    const session = read(global.sessionStorage, SESSION_KEY) || migrateLegacySession();
    if (session) return session;
    clear();
    return null;
  }

  function clear() {
    try {
      global.sessionStorage?.removeItem(SESSION_KEY);
    } catch {
      // Le stockage peut être bloqué par les réglages de confidentialité.
    }
    clearLegacyStorage();
    expireLegacyCookie();
  }

  global.AuthSession = {
    get,
    persist,
    clear,
    normalizeAccountType,
    SESSION_TTL_MS
  };
})(window);
