# Macro Tracker

A mobile-first food tracking app with barcode scanning, macro targets, and historical analytics.

Built with React (Vite), Firebase (Auth + Firestore), Recharts, Tailwind CSS, and Open Food Facts API.

---

## Setup (Step by Step)

### 1. Prerequisites

You need **Node.js** installed. If you don't have it:
- Go to https://nodejs.org
- Download the **LTS** version
- Install it (just click Next through everything)

### 2. Get the Code Running Locally

Open a terminal (Mac: Terminal app, Windows: PowerShell or Command Prompt).

```bash
# Navigate to where you unzipped this project
cd food-tracker

# Install dependencies
npm install

# Copy the env file
cp .env.example .env
```

### 3. Add Your Firebase Config

Open the `.env` file in any text editor and paste in your Firebase config values.

To find these:
1. Go to https://console.firebase.google.com
2. Click your project
3. Click the **gear icon** (top left) → **Project settings**
4. Scroll down to **"Your apps"** → click your web app (or add one)
5. Copy each value into the `.env` file

It should look like this (with your real values):
```
VITE_FIREBASE_API_KEY=AIzaSyBxxxxxxxxxxxxxxxx
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

### 4. Enable Firebase Services

In the Firebase Console:

**Authentication:**
1. Go to **Authentication** → **Sign-in method**
2. Enable **Email/Password**
3. Enable **Google** (select a support email when prompted)

**Firestore:**
1. Go to **Firestore Database** → **Create database**
2. Choose **Start in test mode** (you can lock it down later)
3. Pick a location close to you (e.g., `us-central1`)

### 5. Run Locally

```bash
npm run dev
```

Open the URL it shows (usually http://localhost:5173). You should see the login page.

---

## Deploy to Vercel (Free)

### 1. Push to GitHub

If you don't have a GitHub account, create one at https://github.com.

Create a new repo and push:
```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/food-tracker.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to https://vercel.com and sign in with GitHub
2. Click **"Add New Project"**
3. Import your `food-tracker` repo
4. Before deploying, click **"Environment Variables"** and add all 6 variables from your `.env` file:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
5. Click **Deploy**

### 3. Update Firebase Auth Domain

After deploying, Vercel will give you a URL like `your-app.vercel.app`. You need to authorize this domain in Firebase:

1. Go to Firebase Console → **Authentication** → **Settings** → **Authorized domains**
2. Click **Add domain**
3. Add your Vercel URL (e.g., `your-app.vercel.app`)

That's it. Your app is live.

---

## Features

- **Email/password and Google sign-in** — Multiple users can create accounts
- **Daily macro tracking** — Set calorie targets and macro presets (high protein, balanced, etc.)
- **Food search** — Search Open Food Facts database for any packaged food
- **Barcode scanning** — Point your phone camera at a barcode to look up nutrition info
- **Custom foods** — Create your own food entries with custom macros
- **Recents & Favorites** — Quick access to recently logged and frequently logged foods
- **History charts** — View calorie and macro trends over 7/14/30 days
- **Offline support** — Firestore caches data locally for offline use
- **Mobile-first** — Designed for phone screens, works great on desktop too

---

## Cost

Everything is free:
- **Firebase Spark plan**: Free (50K reads/day, 20K writes/day — more than enough)
- **Vercel Hobby plan**: Free
- **Open Food Facts API**: Free, no API key needed

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| React 18 | UI framework |
| Vite | Build tool |
| Firebase Auth | User authentication |
| Firestore | Real-time database |
| Tailwind CSS | Styling |
| Recharts | Charts & graphs |
| jsQR | Barcode scanning |
| Open Food Facts | Food nutrition database |
