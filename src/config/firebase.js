import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBfuPw9oxAvZo6Sy7Sv96DmNw7E_L5EbGI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "kizilay-c3c96.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "kizilay-c3c96",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "kizilay-c3c96.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1069570752312",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1069570752312:web:97101fd71c8a4f0f244bcd",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-6NPEH6L4WW"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;