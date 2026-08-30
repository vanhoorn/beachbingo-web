import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { auth, db } from "./firebase";

export function useFavorite(gameId: string): [boolean, () => Promise<void>] {
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (!snap.exists()) return;
      setIsFavorite(((snap.data().favoriteGames as string[]) ?? []).includes(gameId));
    }).catch(() => {});
  }, [gameId]);

  async function toggle(): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const next = !isFavorite;
    setIsFavorite(next);
    await updateDoc(doc(db, "users", uid), {
      favoriteGames: next ? arrayUnion(gameId) : arrayRemove(gameId),
    });
  }

  return [isFavorite, toggle];
}

export async function migrateLocalStorageFavorites(uid: string): Promise<void> {
  try {
    const raw = localStorage.getItem("favoriteGames");
    if (!raw) return;
    const local = JSON.parse(raw) as string[];
    if (!Array.isArray(local) || local.length === 0) return;
    await updateDoc(doc(db, "users", uid), {
      favoriteGames: arrayUnion(...local),
    });
    localStorage.removeItem("favoriteGames");
  } catch { /* ignore */ }
}
