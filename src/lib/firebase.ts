import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  projectId: "cardverse-oajwb",
  appId: "1:616399605581:web:37d295c717a11f2856b104",
  storageBucket: "cardverse-oajwb.firebasestorage.app",
  apiKey: "AIzaSyBzOOlyxBLQMt9jJDrYUNphoR1yPDC-FxE",
  authDomain: "cardverse-oajwb.firebaseapp.com",
  messagingSenderId: "616399605581",
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const auth = getAuth(app);

export { app, auth };
