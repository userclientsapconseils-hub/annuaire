const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = __dirname;
const ignoredJavaScript = new Set([
  "connect/api.test.js",
  "connect/function.test.js",
  "connect/session.test.js",
  "home/navigation.test.js",
  "verification.test.js"
]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolutePath) : [absolutePath];
  });
}

const files = walk(root);
const htmlFiles = files.filter((file) => file.endsWith(".html"));
const jsFiles = files.filter((file) => file.endsWith(".js"));

for (const file of jsFiles) {
  const relativePath = path.relative(root, file).replaceAll("\\", "/");
  if (ignoredJavaScript.has(relativePath)) continue;
  new vm.Script(fs.readFileSync(file, "utf8"), { filename: relativePath });
}

for (const file of htmlFiles) {
  const relativePath = path.relative(root, file).replaceAll("\\", "/");
  const html = fs.readFileSync(file, "utf8");
  const inlineScripts = html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi);
  let index = 0;
  for (const match of inlineScripts) {
    new vm.Script(match[1], { filename: `${relativePath}#inline-${++index}` });
  }
}

const headerPages = htmlFiles.filter((file) => fs.readFileSync(file, "utf8").includes("data-site-header"));
for (const file of headerPages) {
  const relativePath = path.relative(root, file).replaceAll("\\", "/");
  const html = fs.readFileSync(file, "utf8");
  const scriptSources = [...html.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  const sessionIndex = scriptSources.findIndex((source) => source.endsWith("connect/session.js") || source === "session.js");
  const navigationIndex = scriptSources.findIndex((source) => source.endsWith("home/navigation.js") || source === "navigation.js");

  assert.ok(sessionIndex >= 0, `${relativePath} doit charger le gestionnaire de session.`);
  assert.ok(navigationIndex > sessionIndex, `${relativePath} doit charger session.js avant navigation.js.`);
  assert.match(html, /home\/navigation\.css|navigation\.css/, `${relativePath} doit charger le style du menu partagé.`);
}

const navigationSource = fs.readFileSync(path.join(root, "home/navigation.js"), "utf8");
assert.match(navigationSource, /AuthSession\?\.get/, "Le menu doit utiliser le gestionnaire de session commun.");
assert.match(navigationSource, /services\/index\.html/, "Le menu doit pointer vers la page Services.");
assert.doesNotMatch(navigationSource, /inscriptiontest\.html/, "Le menu ne doit plus contenir l’ancien lien Services cassé.");
assert.doesNotMatch(navigationSource, /localStorage/, "Le menu ne doit pas lire ou supprimer directement la session.");

const duplicateNavigationSources = [
  "home/script.js",
  "annonce/scripts.js",
  "annonces/script.js",
  "submit/submitindex.html"
].map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
assert.doesNotMatch(
  duplicateNavigationSources,
  /menuToggle\.addEventListener|querySelector\(["']\.nav["']\)/,
  "La gestion du menu mobile doit rester centralisée dans home/navigation.js."
);

const pageStyleSources = [
  "home/styles.css",
  "annonce/styles.css",
  "annonces/styles.css",
  "submit/submitindex.html"
].map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
assert.doesNotMatch(
  pageStyleSources,
  /nav-right a:not\(|btn-primary span:last-child|\.nav\.menu-open \.menu/,
  "Les pages ne doivent plus masquer ou redéfinir les actions du menu mobile."
);

const servicesPageSource = fs.readFileSync(path.join(root, "services/index.html"), "utf8");
const announcementsPageSource = fs.readFileSync(path.join(root, "annonces/index.html"), "utf8");
for (const category of [
  "paysagiste",
  "nettoyage",
  "assistance-administrative",
  "cours-a-domicile",
  "coach-sportif",
  "bricolage",
  "garde-enfants",
  "aide-a-domicile"
]) {
  assert.match(servicesPageSource, new RegExp(`activite=${category}`), `La page Services doit proposer ${category}.`);
  assert.match(announcementsPageSource, new RegExp(`value=["']${category}["']`), `Le filtre des annonces doit accepter ${category}.`);
}

const authenticationSources = [
  "connect/function.js",
  "submit/submitindex.html",
  "espacePersonnel/index.html",
  "espaceParticulier/index.html",
  "devis/script.js"
].map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");

assert.doesNotMatch(
  authenticationSources,
  /localStorage\.(?:setItem|getItem)\s*\(\s*["'](?:authSession|token|userEmail|accountType)["']/,
  "Les jetons et rôles d’authentification ne doivent plus être lus ou écrits directement dans localStorage."
);
assert.doesNotMatch(
  fs.readFileSync(path.join(root, "labo/memo.html"), "utf8"),
  /request\s*:\s*document|getElementById\(["']token["']\)/,
  "Le laboratoire public ne doit plus permettre de fabriquer des requêtes API."
);
assert.match(
  fs.readFileSync(path.join(root, "devis/index.html"), "utf8"),
  /connect\/session\.js/,
  "La demande de devis doit charger le gestionnaire de session."
);
assert.match(
  fs.readFileSync(path.join(root, "devis/index.html"), "utf8"),
  /id="backToOffer"/,
  "La page de devis doit fournir le lien de retour utilisé par son script."
);

const apiSource = fs.readFileSync(path.join(root, "connect/api.js"), "utf8");
assert.match(apiSource, /collection:\s*"privateAsk"/, "Les demandes doivent être privées.");
assert.match(apiSource, /collection:\s*"privateQuote"/, "Les réponses du professionnel doivent être privées.");
assert.doesNotMatch(apiSource, /collection:\s*"quoterequest"/, "L’ancienne collection non prise en charge ne doit plus être utilisée.");

const quoteFormSource = fs.readFileSync(path.join(root, "devis/script.js"), "utf8");
const professionalAreaSource = fs.readFileSync(path.join(root, "espacePersonnel/index.html"), "utf8");
const customerAreaSource = fs.readFileSync(path.join(root, "espaceParticulier/index.html"), "utf8");
assert.match(quoteFormSource, /share:\s*selectedOffer\.userNumber/, "La demande doit cibler le compte propriétaire de l’annonce.");
assert.match(quoteFormSource, /const form = event\.currentTarget/, "Le formulaire doit rester accessible après l’appel asynchrone.");
assert.match(professionalAreaSource, /createQuoteResponse/, "Le professionnel doit pouvoir répondre à la demande.");
assert.match(customerAreaSource, /findQuoteResponses/, "Le particulier doit pouvoir consulter la réponse du professionnel.");

console.log("Vérification globale des scripts réussie.");
