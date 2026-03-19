# MyBonus

Application web de suivi de bankroll et de portfolio crypto. Conçue pour tracker ses performances semaine par semaine, gérer ses dépenses, et surveiller ses wallets en temps réel.

---

## Fonctionnalités

**Bankroll & performances**
- Suivi hebdomadaire des profits et dépôts
- KPIs : ROI, profit total, win rate, meilleure semaine
- Objectif mensuel configurable
- Export CSV de l'historique

**Dépenses**
- Catégories : frais, retraits, impôts, autre
- Intégrées dans le calcul de la bankroll nette

**Analytics**
- Graphiques d'évolution du profit (area chart, bar chart)
- Filtres par année ou toutes périodes

**Portfolio crypto**
- Connexion wallet Ethereum, Solana, Bitcoin (lecture seule ou via WalletConnect)
- Balances en temps réel : ETH, tokens ERC-20, SOL, SPL tokens, BTC
- Conversion EUR automatique
- Transactions récentes par chain

**Marchés**
- 40+ cryptos suivies (BTC, ETH, SOL, HYPE, PEPE, WIF, SUI, BONK...)
- Prix live, graphiques 1H / 24H / 7J / 1M
- Sparklines 7 jours dans la liste
- Cache intelligent pour limiter les appels API

**Partage**
- Lien de partage public configurable pour exposer son dashboard en lecture seule

**Divers**
- Authentification Firebase (email/password)
- Mode sombre / clair
- Multi-devises (EUR, USD, GBP, CHF, CAD)
- PWA installable sur mobile

---

## Stack

- React 19 + Vite
- Firebase (Auth + Firestore)
- Tailwind CSS
- Recharts
- Wagmi + Reown AppKit (WalletConnect)
- CoinGecko API (prix crypto)
- Blockstream API (Bitcoin)
- Helius API (Solana)
- Blockscout / Ethplorer (Ethereum transactions)
- Frankfurter API (taux de change EUR/USD)

---

## Installation

```bash
git clone <repo>
cd mybonus
npm install
```

Créer un fichier `.env.local` à la racine :

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_COINGECKO_KEY=        # optionnel mais très recommandé sinon api très limité — free tier sur coingecko.com
VITE_HELIUS_API_KEY=       # optionnel — free tier sur helius.dev (Solana)
```

```bash
npm run dev
```

---

## Déploiement

Le projet est configuré pour Firebase Hosting.

```bash
npm run deploy
```

Ce script fait `vite build` puis `firebase deploy`.

---

## Architecture

```
src/
  components/       composants UI réutilisables
  context/          AuthContext, ThemeContext, WalletContext
  firebase/         config, auth, firestore
  hooks/            useWallet (ETH), useSolanaWallet, useBitcoinWallet, useEntries, useExpenses...
  pages/            Dashboard, Entries, Analytics, Market, Portfolio, Settings, SharedView
  services/         priceCache.js — cache centralisé des prix crypto
  utils/            stats.js, walletError.js
```

**Gestion des requêtes API**

Tous les prix crypto passent par `src/services/priceCache.js` qui centralise les appels CoinGecko avec un TTL de 2 minutes et une deduplication des requêtes simultanées. Les wallets ne font jamais d'appels CoinGecko indépendants.

---

## Limites connues

- CoinGecko free tier : ~30 req/min. En dev, l'IP localhost est plus vite throttlée qu'en production. Renseigner `VITE_COINGECKO_KEY` atténue le problème.
- Les RPC Ethereum publics peuvent être instables. Le hook tente 4 endpoints en cascade.
- Bitcoin : lecture seule via adresse publique (pas de WalletConnect BTC natif).

