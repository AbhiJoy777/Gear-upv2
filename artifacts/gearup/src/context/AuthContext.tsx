import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      // Bootstrap user doc — preserve existing user-set fields
      setProfile(null);
      setLoading(true);
      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(userRef);
        const base: any = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL || null,
          updatedAt: serverTimestamp(),
        };
        if (!snap.exists()) {
          base.createdAt = serverTimestamp();
          await setDoc(userRef, base);
        } else {
          await updateDoc(userRef, base);
        }
      } catch (e) {
        console.error('User doc bootstrap error:', e);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setProfile(snap.data() || null);
      setLoading(false);
    }, (error) => {
      console.error('Profile fetch error:', error);
      setLoading(false);
    });
    return () => unsubscribeProfile();
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
