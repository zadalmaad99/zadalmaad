import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAdPQ8qaxcFqNXBAhf-sAKcxqugJE1Dw20",
  authDomain: "quran-26d25.firebaseapp.com",
  projectId: "quran-26d25",
  storageBucket: "quran-26d25.firebasestorage.app",
  messagingSenderId: "887321813302",
  appId: "1:887321813302:web:f8f80a242eda8e597fd397",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
