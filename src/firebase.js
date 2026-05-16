import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB5dV49EkL7YtEPNFVgyhzWSuHp02ut5lg",
  authDomain: "restro-manager-7cf02.firebaseapp.com",
  projectId: "restro-manager-7cf02",
  storageBucket: "restro-manager-7cf02.firebasestorage.app",
  messagingSenderId: "482064185696",
  appId: "1:482064185696:web:9df3e099c540cbfe358605"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);