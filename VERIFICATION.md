# Vérification de l’authentification

## Architecture constatée

- Frontend statique HTML, CSS et JavaScript.
- Appels directs avec Axios vers une URL AWS Lambda.
- Aucun code backend, schéma de base de données, migration ou configuration d’environnement dans ce dépôt.
- Authentification historique par jeton renvoyé dans `data`, avec des comptes récents typés `pro` ou `customer` et des comptes anciens sans type.

## Diagnostic

- La Lambda utilise le statut HTTP `301` sans en-tête `Location` pour signaler qu’une recherche ou une authentification n’a aucun résultat. Le frontend interprétait ce statut comme une panne serveur.
- Le rôle enregistré dans `localStorage` pouvait influencer la résolution du compte et la redirection.
- Le jeton était dupliqué dans `localStorage` et dans un cookie lisible par JavaScript.
- Le fallback de connexion sans rôle pouvait devenir ambigu lorsque deux anciens comptes partageaient la même adresse.
- L’inscription acceptait un mot de passe sans longueur minimale ni confirmation et pouvait prendre une chaîne de réponse d’insertion pour un jeton.
- Une demande de devis pouvait être envoyée sans session particulière.
- Deux pages publiques de laboratoire acceptaient des mots de passe, affichaient des jetons ou permettaient de construire des opérations API génériques.

## Corrections vérifiées

- Gestion centralisée de session dans `connect/session.js`.
- Session conservée pendant les rafraîchissements et la navigation de l’onglet via `sessionStorage`, avec expiration à 12 heures.
- Migration puis suppression des anciennes clés de session stockées dans `localStorage`.
- Suppression du cookie d’authentification JavaScript historique.
- Rôle exigé par chaque route privée et revérifié auprès de l’API.
- Statut `301` correctement interprété comme un refus ou une absence de résultat pour la connexion.
- Jetons numériques historiques de la Lambda normalisés en texte avant la création de la session.
- Fallback historique accepté uniquement lorsque le rôle est unique et cohérent.
- Validation de l’e-mail, longueur de mot de passe de 12 à 128 caractères et confirmation du mot de passe.
- Connexion automatique après inscription fondée uniquement sur un vrai jeton de connexion.
- Demandes de devis limitées aux sessions particulières et envoyées avec leur jeton.
- Demandes enregistrées dans `privateAsk` avec le compte professionnel comme destinataire (`share`).
- Validation ou refus enregistré dans `privateQuote`, sans tenter de modifier la demande appartenant au particulier.
- Statut présenté au particulier uniquement lorsque la réponse provient du professionnel visé par la demande.
- Pages publiques de laboratoire neutralisées et client API professionnel obsolète supprimé.

## Tests automatisés

- `connect/api.test.js` — PASS
  - réponses de jeton texte et numérique ;
  - statut `301` ;
  - comptes typés et historiques ;
  - adresse dupliquée ambiguë ;
  - rôle non issu du stockage local ;
  - inscription des deux rôles ;
  - jeton et destinataire obligatoires pour les demandes privées ;
  - lecture de `privateAsk` et `privateQuote` ;
  - validation des statuts et du destinataire d’une réponse professionnelle.
- `connect/session.test.js` — PASS
  - persistance après rafraîchissement ;
  - migration des anciennes sessions ;
  - expiration ;
  - refus des rôles non autorisés.
- `connect/function.test.js` — PASS
  - connexion professionnelle ;
  - refus d’un rôle incohérent ;
  - redirection particulière ;
  - suppression d’une session dont le rôle ne peut pas être vérifié.
- `verification.test.js` — PASS
  - syntaxe des scripts externes et intégrés ;
  - absence de stockage direct du jeton et du rôle dans `localStorage` ;
  - neutralisation du laboratoire API ;
  - absence de l’ancienne collection `quoterequest` et présence des deux collections privées.

## Tests navigateur

- Page de connexion desktop — PASS.
- E-mail invalide et bouton réactivé — PASS.
- Identifiants factices refusés avec un message utilisateur — PASS.
- Confirmation de mot de passe — PASS.
- Route professionnelle sans session redirigée vers la connexion — PASS.
- Route particulière sans session redirigée vers la connexion — PASS.
- Connexion mobile à 390 × 844 sans débordement horizontal — PASS.
- Erreurs console pendant ces scénarios — aucune.
- Création d’un compte particulier et d’un compte professionnel dédiés aux tests — PASS.
- Création et lecture d’une annonce professionnelle fictive — PASS.
- Envoi privé d’une demande depuis le compte particulier — PASS.
- Réception puis validation depuis le compte professionnel — PASS.
- Persistance de la validation après rechargement de l’espace professionnel — PASS.
- Affichage du statut « Validée » dans l’espace particulier — PASS.

## Vérification distante sans effet de bord

- CORS depuis le domaine GitHub Pages — PASS (`OPTIONS 200`, origine et méthode autorisées).
- Lecture de la collection publique des annonces — PASS (`200`).
- Identifiants factices et recherches privées sans session — refusés (`301`, aucune donnée retournée).

## Limites nécessitant le backend

Les points suivants ne peuvent pas être garantis par ce dépôt statique :

- association cryptographique du jeton avec l’identité et le rôle ;
- autorisation par propriétaire sur chaque ressource ;
- unicité de l’adresse e-mail ;
- validation serveur des inscriptions ;
- méthode de hachage des mots de passe ;
- expiration et révocation serveur du jeton ;
- endpoint de déconnexion ;
- cookie de session `HttpOnly` ;
- limitation des tentatives de connexion ;
- protection CSRF correspondant au futur mécanisme de cookie.

Pour terminer la sécurisation, il faut fournir ou modifier le backend de la Lambda et exposer des opérations dédiées (`register`, `login`, `me`, `logout`) ainsi que des endpoints métier qui calculent l’identité et la propriété depuis la session, jamais depuis l’e-mail ou l’identifiant envoyé par le navigateur.

