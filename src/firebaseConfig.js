// Values from Firebase console → Project settings → Your apps → Web app.
// These are not secrets: access is controlled by firestore.rules.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);
