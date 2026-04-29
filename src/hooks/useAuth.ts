'use client';

import { auth } from '@/src/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export const useAuthActions = () => {
  const router = useRouter();

  const logout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return { logout };
};
