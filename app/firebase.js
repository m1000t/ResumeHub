// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDCrbanH3bFcgaULevJ_0C7dGf2TrzI7FE",
  authDomain: "resumehub-76d44.firebaseapp.com",
  projectId: "resumehub-76d44",
  storageBucket: "resumehub-76d44.firebasestorage.app",
  messagingSenderId: "880026329092",
  appId: "1:880026329092:web:2be6afa3c3c1cea6315551",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider };
