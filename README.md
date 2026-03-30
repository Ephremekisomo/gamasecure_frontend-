# Goma Security Frontend

Frontend pour l'application de sécurité urbaine de Goma, RDC.

## Description

Application web progressive (PWA) permettant aux citoyens de Goma de signaler des urgences, recevoir des alertes, et communiquer avec les services de sécurité.

## Fonctionnalités

- 🚨 Signalement d'urgences en temps réel
- 📍 Géolocalisation automatique
- 📱 Application Progressive (PWA) - fonctionne hors ligne
- 🔔 Notifications push
- 👤 Gestion du profil utilisateur
- 📊 Tableau de bord administrateur
- 🏢 Gestion des postes de sécurité
- 📈 Statistiques et rapports

## Pages disponibles

- **index.html** - Page d'accueil et connexion
- **admin.html** - Tableau de bord administrateur
- **security-center.html** - Centre de sécurité
- **poste.html** - Gestion des postes

## Prérequis

- Node.js >= 14.0.0 (optionnel, pour le serveur de développement)
- Un navigateur web moderne

## Installation

```bash
# Cloner le repository
git clone <URL_DU_REPO_FRONTEND>

# Entrer dans le dossier
cd goma-security-frontend

# Installer les dépendances (optionnel)
npm install
```

## Lancement

### Option 1: Avec npm (recommandé pour le développement)

```bash
# Lancer le serveur de développement
npm start

# Ou avec hot-reload
npm run dev
```

Le site sera accessible à l'adresse `http://localhost:3000`

### Option 2: Sans installation (fichiers statiques)

Ouvrez simplement le fichier `public/index.html` dans votre navigateur.

### Option 3: Avec un serveur web

Copiez le contenu du dossier `public/` sur votre serveur web (Apache, Nginx, etc.)

## Configuration

### Connexion au Backend

Modifiez l'URL du backend dans les fichiers JavaScript :

```javascript
// Dans public/app.js, public/admin.js, etc.
const API_URL = 'https://votre-backend.com/api';
const SOCKET_URL = 'https://votre-backend.com';
```

### Service Worker

Le service worker (`sw.js`) gère :
- Le cache des fichiers statiques
- Les notifications push
- Le fonctionnement hors ligne

## Structure du projet

```
frontend/
├── package.json       # Dépendances
├── .gitignore         # Fichiers ignorés par Git
├── README.md          # Documentation
└── public/            # Fichiers statiques
    ├── index.html     # Page d'accueil
    ├── admin.html     # Administration
    ├── security-center.html
    ├── poste.html     # Postes de sécurité
    ├── app.js         # Logique principale
    ├── admin.js       # Logique admin
    ├── security-center.js
    ├── poste.js       # Logique postes
    ├── styles.css     # Styles principaux
    ├── admin.css      # Styles admin
    ├── security-center.css
    ├── poste.css      # Styles postes
    ├── manifest.json  # Manifeste PWA
    └── sw.js          # Service Worker
```

## Déploiement

### GitHub Pages

1. Poussez le code sur GitHub
2. Allez dans Settings > Pages
3. Sélectionnez la branche `main` et le dossier `/root`
4. Le site sera déployé automatiquement

### Netlify

1. Connectez votre repository GitHub
2. Configurez le build :
   - Build command: `echo "No build required"`
   - Publish directory: `public`
3. Déployez

### Vercel

1. Importez votre repository
2. Configurez :
   - Framework Preset: Other
   - Output Directory: `public`
3. Déployez

### Serveur traditionnel

1. Copiez le contenu de `public/` sur votre serveur
2. Configurez votre serveur web pour servir les fichiers statiques
3. Assurez-vous que le service worker est accessible

## PWA (Progressive Web App)

Cette application est une PWA, ce qui signifie :

- ✅ Installation possible sur mobile et desktop
- ✅ Fonctionnement hors ligne
- ✅ Notifications push
- ✅ Mise à jour automatique

### Installation sur mobile

1. Ouvrez l'application dans Chrome/Safari
2. Cliquez sur "Ajouter à l'écran d'accueil"
3. L'application sera installée comme une app native

## Technologies

- **HTML5** - Structure
- **CSS3** - Styles
- **JavaScript (ES6+)** - Logique
- **Service Worker** - Cache et notifications
- **Web Push API** - Notifications push
- **Geolocation API** - Géolocalisation
- **LocalStorage** - Stockage local

## Support

Pour toute question ou problème, veuillez ouvrir une issue sur le repository.

## License

MIT © Goma Security Team
