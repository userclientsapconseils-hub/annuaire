# Passation API — abonnements professionnels avec Stripe

## 1. Périmètre validé

Le site présente trois offres professionnelles, facturées mensuellement :

| Offre | Prix affiché |
| --- | ---: |
| Gratuite | 0 € |
| Standard | 5 € HT / mois |
| Premium | 10 € HT / mois |

Le front inclus dans cette PR n’effectue aucun paiement et ne modifie aucune Lambda. Les boutons Standard et Premium restent désactivés tant que l’intégration serveur n’est pas disponible.

Les fonctionnalités exactes réservées à Standard et Premium restent à définir. Il ne faut donc pas ajouter de blocage fonctionnel côté front ou API avant validation de cette matrice.

## 2. Principe de sécurité

L’API doit être la source de vérité pour :

- l’offre commerciale souscrite ;
- l’état de l’abonnement ;
- l’offre donnant réellement accès aux fonctionnalités ;
- les capacités autorisées ;
- la création des sessions Stripe Checkout et Customer Portal.

Le navigateur ne doit jamais recevoir la clé secrète Stripe, le secret de webhook, ni pouvoir décider lui-même qu’un paiement est valide. Il ne faut pas accepter depuis le navigateur un montant, une devise ou un identifiant de prix Stripe : le front envoie uniquement l’offre demandée (`standard` ou `premium`) et l’API choisit l’identifiant de prix autorisé.

## 3. Modèle de données conseillé

À stocker sur le compte professionnel ou dans une collection d’abonnements liée par un identifiant utilisateur interne stable :

```json
{
  "plan": "standard",
  "accessPlan": "standard",
  "subscriptionStatus": "active",
  "stripeCustomerId": "cus_...",
  "stripeSubscriptionId": "sub_...",
  "stripePriceId": "price_...",
  "currentPeriodEnd": "2026-10-20T12:00:00.000Z",
  "cancelAtPeriodEnd": false,
  "capabilities": ["listing.highlight"]
}
```

Valeurs attendues :

- `plan` et `accessPlan` : `free`, `standard` ou `premium`
- `subscriptionStatus` : `none`, `incomplete`, `trialing`, `active`, `past_due`, `canceled` ou `unpaid`
- `capabilities` : liste de chaînes définies côté serveur

`plan` décrit la formule commerciale. `accessPlan` décrit les droits réellement accordés à cet instant. Cette séparation permet de gérer proprement une résiliation en fin de période ou un paiement à régulariser, sans recopier la logique Stripe dans le front.

Migration : tout compte professionnel existant sans donnée d’abonnement doit être considéré comme `free`, avec `subscriptionStatus: "none"`.

## 4. Opérations API à prévoir

Les noms ci-dessous sont indicatifs ; ils peuvent être adaptés aux conventions de la Lambda existante.

### Lire l’abonnement courant

Requête authentifiée :

```json
{
  "action": "getSubscription"
}
```

Réponse :

```json
{
  "plan": "free",
  "accessPlan": "free",
  "subscriptionStatus": "none",
  "currentPeriodEnd": null,
  "cancelAtPeriodEnd": false,
  "capabilities": []
}
```

L’utilisateur doit être identifié à partir du jeton serveur. Ne pas accepter d’adresse e-mail fournie par le navigateur comme preuve d’identité.

### Créer une session Checkout

Requête authentifiée :

```json
{
  "action": "createCheckoutSession",
  "plan": "standard"
}
```

Réponse :

```json
{
  "checkoutUrl": "https://checkout.stripe.com/..."
}
```

Règles :

1. Refuser toute valeur autre que `standard` ou `premium`.
2. Sélectionner le Price Stripe depuis la configuration serveur.
3. Réutiliser ou créer un Customer Stripe lié à l’identifiant utilisateur interne.
4. Créer une Checkout Session en mode abonnement.
5. Placer l’identifiant utilisateur interne dans les métadonnées utiles à la réconciliation.
6. Utiliser des URL de succès et d’annulation appartenant au domaine autorisé.
7. Ne jamais activer l’offre sur la seule base du retour navigateur.

### Créer une session Customer Portal

Requête authentifiée :

```json
{
  "action": "createBillingPortalSession"
}
```

Réponse :

```json
{
  "portalUrl": "https://billing.stripe.com/..."
}
```

La session doit être créée à la demande pour le Customer Stripe du professionnel authentifié. Le bouton « Gérer mon abonnement » pourra être activé par le front lorsque cette opération existera.

## 5. Webhook Stripe

Prévoir un point d’entrée serveur dédié capable de vérifier la signature Stripe sur le corps brut de la requête avant tout traitement.

Événements minimum à traiter :

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Exigences :

- enregistrer chaque identifiant d’événement Stripe traité pour garantir l’idempotence ;
- répondre rapidement avec un code 2xx après traitement fiable ;
- ne jamais faire confiance aux métadonnées sans vérifier les objets Stripe liés ;
- journaliser les échecs sans écrire de clé ou de donnée de paiement sensible ;
- recalculer `plan`, `accessPlan` et `subscriptionStatus` côté serveur ;
- conserver les droits jusqu’à la fin de la période déjà payée lorsqu’une résiliation est programmée, puis repasser en offre gratuite.

## 6. Variables de configuration serveur

Noms recommandés (les valeurs ne doivent jamais être commitées) :

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_STANDARD_PRICE_ID
STRIPE_PREMIUM_PRICE_ID
APP_BASE_URL
```

Créer dans Stripe deux prix mensuels récurrents, l’un à 5 € HT et l’autre à 10 € HT. La gestion de la TVA, des factures et des mentions légales doit être validée avant la mise en production.

## 7. Contrat avec le front livré

Le module `billing/plans.js` contient uniquement le catalogue d’affichage et normalise la réponse de l’API. Il ne valide aucun paiement.

Points d’intégration préparés :

- `window.renderProfessionalSubscription(payload)` dans `espacePersonnel/index.html`
- `window.renderProfessionalPlans(payload)` dans `offres/script.js`

Après ajout des opérations API :

1. charger `getSubscription` après vérification de la session professionnelle ;
2. passer la réponse à ces fonctions d’affichage ;
3. activer le bouton de l’offre payante ;
4. appeler `createCheckoutSession`, puis rediriger uniquement vers l’URL renvoyée ;
5. activer « Gérer mon abonnement », appeler `createBillingPortalSession`, puis rediriger vers l’URL renvoyée ;
6. après retour de Stripe, relire `getSubscription` au lieu de faire confiance aux paramètres de l’URL.

Même si le front masque une fonctionnalité, l’API doit vérifier la capacité correspondante pour chaque action protégée.

## 8. Tests avant mise en production

- utiliser le mode test Stripe et les cartes de test ;
- vérifier création, renouvellement, échec de paiement, régularisation et résiliation ;
- rejouer un même webhook pour confirmer l’idempotence ;
- tester un webhook avec une signature invalide ;
- vérifier qu’un particulier ne peut pas créer de session d’abonnement pro ;
- vérifier qu’un utilisateur ne peut pas ouvrir le portail d’un autre Customer ;
- vérifier la migration des comptes professionnels existants vers l’offre gratuite ;
- vérifier l’expiration et la révocation des droits côté API.

Documentation Stripe utile :

- Checkout et abonnements : https://docs.stripe.com/payments/checkout/build-subscriptions
- Signatures de webhook : https://docs.stripe.com/webhooks/signature
- Customer Portal : https://docs.stripe.com/customer-management/integrate-customer-portal
