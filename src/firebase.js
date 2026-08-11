import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAdPQ8qaxcFqNXBAhf-sAKcxqugJE1Dw20",
  authDomain: "quran-26d25.firebaseapp.com",
  projectId: "quran-26d25",
  storageBucket: "quran-26d25.firebasestorage.app",
  messagingSenderId: "887321813302",
  appId: "1:887321813302:web:f8f80a242eda8e597fd397",
};

export const ADMIN_EMAILS = ["mathelove2@gmail.com"];

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export async function createStudentAccount(email, password) {
  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      email,
      password
    );
    return credential.user.uid;
  } finally {
    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp);
  }
}
