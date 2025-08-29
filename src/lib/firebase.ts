
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFirestore, initializeFirestore, persistentLocalCache } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

// A function to initialize Firebase and return app, creating it if it doesn't exist.
// This prevents re-initialization in the client-side/hot-reload environment.
const getFirebaseApp = () => {
    // Check if all required config values are present before initializing
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        console.warn("Firebase config not complete, skipping initialization.");
        return null;
    }

    if (getApps().length === 0) {
        return initializeApp(firebaseConfig);
    }
    return getApp();
};

const app = getFirebaseApp();

// Initialize services only if the app was successfully initialized
const auth = app ? getAuth(app) : null;
const db = app ? initializeFirestore(app, { localCache: persistentLocalCache() }) : null;
const rtdb = app ? getDatabase(app) : null;
const storage = app ? getStorage(app) : null;
const googleProvider = app ? new GoogleAuthProvider() : null;

export { app, auth, db, rtdb, storage, googleProvider };
