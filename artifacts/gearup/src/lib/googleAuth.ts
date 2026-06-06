import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';
import {
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  signInWithCredential,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

const getNativeGoogleCredential = async () => {
  const result = await FirebaseAuthentication.signInWithGoogle({
    skipNativeAuth: true,
  });
  const idToken = result.credential?.idToken;
  const accessToken = result.credential?.accessToken;

  if (!idToken && !accessToken) {
    throw new Error('Google sign-in did not return a Firebase credential.');
  }

  return GoogleAuthProvider.credential(idToken, accessToken);
};

export const signInWithGearUpGoogle = async () => {
  if (!Capacitor.isNativePlatform()) {
    return signInWithPopup(auth, googleProvider);
  }

  const credential = await getNativeGoogleCredential();
  return signInWithCredential(auth, credential);
};

export const linkGearUpGoogle = async (user: User) => {
  if (!Capacitor.isNativePlatform()) {
    return linkWithPopup(user, googleProvider);
  }

  const credential = await getNativeGoogleCredential();
  return linkWithCredential(user, credential);
};
