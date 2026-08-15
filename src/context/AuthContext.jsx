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

  return (
    <AuthContext.Provider value={{ user, role, isAdmin, isSuperadmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
