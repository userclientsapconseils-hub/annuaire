const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = __dirname;
const ignoredJavaScript = new Set([
  "connect/api.test.js",
  "connect/function.test.js",
  "connect/session.test.js",
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

console.log("Vérification globale des scripts réussie.");
