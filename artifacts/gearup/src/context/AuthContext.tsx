import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { arrayUnion, doc, onSnapshot, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

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
        const providerIds = firebaseUser.providerData.map((provider) => provider.providerId);
        const hasGoogle = providerIds.includes('google.com');
        const hasPhone = providerIds.includes('phone');
        const hasPassword = providerIds.includes('password');
        const primaryAuthProvider = hasGoogle ? 'google.com' : hasPhone ? 'phone' : hasPassword ? 'password' : providerIds[0] || 'unknown';
        const base: any = {
          uid: firebaseUser.uid,
          updatedAt: serverTimestamp(),
        };
        if (firebaseUser.email) {
          base.email = firebaseUser.email;
          base.emailVerified = Boolean(firebaseUser.emailVerified || hasGoogle);
        }
        if (firebaseUser.phoneNumber) {
          base.phone = firebaseUser.phoneNumber;
          base.phoneVerified = true;
          base.phoneVerifiedAt = serverTimestamp();
        }
        if (firebaseUser.photoURL) base.photoURL = firebaseUser.photoURL;
        if (providerIds.length > 0) base.authProviders = arrayUnion(...providerIds);
        if (!snap.exists() || !snap.data()?.primaryAuthProvider) base.primaryAuthProvider = primaryAuthProvider;
        if (!snap.exists()) {
          base.createdAt = serverTimestamp();
          await setDoc(userRef, base, { merge: true });
        } else {
          await setDoc(userRef, base, { merge: true });
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
