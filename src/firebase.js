import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig';
import { createFirebaseBackend } from './firebaseBackend';

function init() {
  if (!isFirebaseConfigured) return { auth: null, backend: null };

  const app = initializeApp(firebaseConfig);
  // On the web Firebase keeps the session in the browser by default; on the
  // phone it needs AsyncStorage, otherwise the user is logged out on restart.
  const auth =
    Platform.OS === 'web'
      ? getAuth(app)
      : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  auth.languageCode = 'tr';

  return { auth, backend: createFirebaseBackend(getFirestore(app)) };
}

export const { auth, backend } = init();
