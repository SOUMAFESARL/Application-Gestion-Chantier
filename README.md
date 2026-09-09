# 📱 Application - Gestion de Chantier (Frontend)

Bienvenue sur le dépôt frontend de l'application de gestion de chantier BTP.  
L'application est construite avec **Next.js 16**, **React 19** et **TypeScript**.  
Elle respecte la charte graphique officielle et communique avec l'API Django backend.

Ce guide est fait pour vous permettre de lancer le frontend sur votre machine rapidement et simplement.

---

## 📋 1. Prérequis

Avant de commencer, vérifiez que vous avez installé :
* **Node.js 20** (ou supérieur)
* **npm** (inclus avec Node.js)
* **Git**

---

## 🚀 2. Installation pas à pas

### Étape 1 : Cloner le projet
Ouvrez votre terminal et lancez :
```bash
git clone https://github.com/SOUMAFESARL/Application-Gestion-Chantier.git
cd Application-Gestion-Chantier
```

### Étape 2 : Installer les dépendances
Installez les bibliothèques du projet avec npm :
```bash
npm install
```

---

## ⚙️ 3. Configuration de l'environnement local

Créez votre fichier de configuration locale `.env.local` à partir de l'exemple :

**Sur Windows (PowerShell ou Invite de commandes) :**
```powershell
copy .env.example .env.local
```

**Sur Linux ou Mac :**
```bash
cp .env.example .env.local
```

> 💡 **Le fichier est déjà pré-rempli pour le développement local :**  
> * Il pointe automatiquement sur l'API locale (`http://localhost:8000`).  
> * Si votre API backend tourne sur votre machine, mettez `NEXT_PUBLIC_API_SIMULE=0` dans `.env.local`.  
> * Si l'API backend n'est pas encore lancée, laissez `NEXT_PUBLIC_API_SIMULE=1` pour tester les écrans avec les données de test.

---

## ▶️ 4. Démarrer le projet

Lancez le serveur de développement :
```bash
npm run dev
```

Ouvrez ensuite votre navigateur sur :  
👉 **http://localhost:3000**

---

## 🎨 5. Écrans et Découverte

* **Application principale :**  
  Accédez à l'accueil et aux formulaires sur `http://localhost:3000`.

* **Design System (Catalogue de composants) :**  
  Vous pouvez visualiser et tester tous les composants de l'interface (boutons, formulaires, alertes, badges, tableaux) sur :  
  `http://localhost:3000/design-system`

* **Compte de démo (avec l'API backend connectée) :**  
  * **Identifiant :** `admin@demo.ci`  
  * **Mot de passe :** `Demo1234!`

---

## 🛠️ 6. Commandes utiles

* **Démarrer en mode développement :**
  ```bash
  npm run dev
  ```
* **Vérifier le code (Linter) :**
  ```bash
  npm run lint
  ```
* **Vérifier les types TypeScript :**
  ```bash
  npx tsc --noEmit
  ```
* **Compiler pour la production :**
  ```bash
  npm run build
  ```

---

## 🤝 Besoin d'aide ?
Si vous avez une question sur un composant ou un parcours, contactez l'équipe technique SOUMAFE SARL.