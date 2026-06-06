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

const logNativeGoogleAuth = (message: string, details?: unknown) => {
  if (!import.meta.env.DEV) return;
  if (details === undefined) {
    console.log(`[GoogleAuth] ${message}`);
    return;
  }
  console.log(`[GoogleAuth] ${message}`, details);
};

const logNativeGoogleError = (stage: string, error: any) => {
  if (!import.meta.env.DEV) return;
  console.error(`[GoogleAuth] ${stage}`, {
    code: error?.code,
    message: error?.message,
    name: error?.name,
    error,
  });
};

const summarizeNativeResult = (result: Awaited<ReturnType<typeof FirebaseAuthentication.signInWithGoogle>>) => ({
  user: result.user
    ? {
        uidPresent: Boolean(result.user.uid),
        emailPresent: Boolean(result.user.email),
        displayNamePresent: Boolean(result.user.displayName),
        providerId: result.user.providerId,
      }
    : null,
  credential: result.credential
    ? {
        providerId: result.credential.providerId,
        hasIdToken: Boolean(result.credential.idToken),
        hasAccessToken: Boolean(result.credential.accessToken),
        hasServerAuthCode: Boolean(result.credential.serverAuthCode),
      }
    : null,
  additionalUserInfo: result.additionalUserInfo
    ? {
        isNewUser: result.additionalUserInfo.isNewUser,
        providerId: result.additionalUserInfo.providerId,
        hasProfile: Boolean(result.additionalUserInfo.profile),
        hasUsername: Boolean(result.additionalUserInfo.username),
      }
    : null,
});

const getNativeGoogleCredential = async () => {
  let result: Awaited<ReturnType<typeof FirebaseAuthentication.signInWithGoogle>>;
  try {
    result = await FirebaseAuthentication.signInWithGoogle({
      skipNativeAuth: true,
      useCredentialManager: true,
    });
  } catch (error) {
    logNativeGoogleError('Native FirebaseAuthentication.signInWithGoogle failed', error);
    throw error;
  }

  logNativeGoogleAuth('Native sign-in result (tokens redacted)', summarizeNativeResult(result));
  const idToken = result.credential?.idToken;
  const accessToken = result.credential?.accessToken;
  logNativeGoogleAuth('Native credential availability', {
    hasIdToken: Boolean(idToken),
    hasAccessToken: Boolean(accessToken),
  });

  if (!idToken && !accessToken) {
    throw new Error('Google sign-in did not return a Firebase credential.');
  }

  return GoogleAuthProvider.credential(idToken, accessToken);
};

export const signInWithGearUpGoogle = async () => {
  const platform = Capacitor.getPlatform();
  const useNativeAuth = Capacitor.isNativePlatform();
  logNativeGoogleAuth('Authentication path', { platform, useNativeAuth });

  if (!useNativeAuth) {
    return signInWithPopup(auth, googleProvider);
  }

  const credential = await getNativeGoogleCredential();
  try {
    return await signInWithCredential(auth, credential);
  } catch (error) {
    logNativeGoogleError('Firebase JS signInWithCredential failed', error);
    throw error;
  }
};

export const linkGearUpGoogle = async (user: User) => {
  const platform = Capacitor.getPlatform();
  const useNativeAuth = Capacitor.isNativePlatform();
  logNativeGoogleAuth('Account linking path', { platform, useNativeAuth });

  if (!useNativeAuth) {
    return linkWithPopup(user, googleProvider);
  }

  const credential = await getNativeGoogleCredential();
  try {
    return await linkWithCredential(user, credential);
  } catch (error) {
    logNativeGoogleError('Firebase JS linkWithCredential failed', error);
    throw error;
  }
};

export const getGearUpGoogleErrorMessage = (error: any, linking = false) => {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  const isAndroidConfigurationError =
    code === '10' ||
    code.includes('developer_error') ||
    message.includes('developer_error') ||
    message.includes('configuration') ||
    message.includes('default_web_client_id') ||
    message.includes('will_be_overridden');

  if (isAndroidConfigurationError) {
    return 'Google sign-in is not configured for this Android build.';
  }
  if (code.includes('credential-already-in-use') || code.includes('account-exists-with-different-credential')) {
    return 'This Google account is already linked to another GearUp account.';
  }
  if (code.includes('network-request-failed')) {
    return 'Could not reach Google sign-in. Check your connection and try again.';
  }
  if (code.includes('popup-closed-by-user') || code.includes('cancelled') || message.includes('cancelled')) {
    return 'Google sign-in was cancelled.';
  }
  return linking ? 'Could not connect Google account. Please try again.' : 'Google sign-in failed. Please try again.';
};
