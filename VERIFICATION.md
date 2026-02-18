# Vérification technique (front + scripts)

Ce document résume les contrôles effectués sur le projet.

## Contrôles réalisés

- Vérification de syntaxe JavaScript sur les scripts externes :
  - `home/script.js`
  - `annonce/scripts.js`
- Vérification de syntaxe JavaScript sur le script inline de `submit/submitindex.html`.
- Vérification visuelle avec Playwright sur les pages :
  - `index.html`
  - `annonce/annonceindex.html`
  - `submit/submitindex.html`
- Vérification responsive sur 2 résolutions :
  - Desktop : `1440x900`
  - Mobile : `390x844`
- Contrôle des erreurs runtime :
  - `console.error`
  - `pageerror`

## Résultat

Aucune erreur JavaScript détectée.

Aucune erreur navigateur (`console.error` / `pageerror`) détectée sur les pages testées.

L'affichage est cohérent et responsive sur les résolutions testées.
