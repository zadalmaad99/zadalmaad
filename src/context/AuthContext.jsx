import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, SUPERADMIN_EMAILS } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const [role, setRole] = useState(null); // "superadmin" | "admin" | "student" | null

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) {
      setRole(null);
      return;
    }
    if (SUPERADMIN_EMAILS.includes(user.email)) {
      setRole("superadmin");
      return;
    }
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      setRole(snap.data()?.role || "student");
    });
    return unsub;
  }, [user]);

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const logout = () => signOut(auth);

  const isSuperadmin = role === "superadmin";
  const isAdmin = role === "superadmin" || role === "admin";
  // Among the two superadmin emails, mathelove2@gmail.com is the "owner"
  // account with full unsupervised control; admin.zadalmaad@admin.com is
  // superadmin too (changes still apply immediately, per the owner's own
  // call), but every change it makes is logged and surfaced to the owner —
  // see src/utils/pendingChanges.js.
  const isSupersuperadmin = isSuperadmin && user?.email === "mathelove2@gmail.com";
  const isWatchedSuperadmin = isSuperadmin && !isSupersuperadmin;

  return (
    <AuthContext.Provider
      value={{ user, role, isAdmin, isSuperadmin, isSupersuperadmin, isWatchedSuperadmin, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
