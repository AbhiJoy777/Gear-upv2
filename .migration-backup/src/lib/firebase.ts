import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Replace these strings with the ones from your Firebase Project Settings
const firebaseConfig = {
  apiKey: "AIzaSyADoUIokkafWeU5d4wV4fCVS65ButyUHio",
  authDomain: "gearup-official.firebaseapp.com",
  projectId: "gearup-official",
  storageBucket: "gearup-official.firebasestorage.app",
  messagingSenderId: "603951083486",
  appId: "1:603951083486:web:57e08a1a126e945678374f"
};

// Initialize Firebase (Prevents "already exists" errors during Next.js hot reloads)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);