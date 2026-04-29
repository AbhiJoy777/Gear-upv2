

import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useLocation } from 'wouter';

export const useAuthActions = () => {
  const [, setLocation] = useLocation();

  const logout = async () => {
    try {
      await signOut(auth);
      setLocation('/');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return { logout };
};
