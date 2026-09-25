// Values from Firebase console → Project settings → Your apps → Web app.
// These are not secrets: access is controlled by firestore.rules.
export const firebaseConfig = {
  apiKey: 'AIzaSyDK8Xgoj3X5OKFU1SSMUpA2I2aP6XGzG4U',
  authDomain: 'yapilacaklar-9c287.firebaseapp.com',
  projectId: 'yapilacaklar-9c287',
  storageBucket: 'yapilacaklar-9c287.firebasestorage.app',
  messagingSenderId: '624990938618',
  appId: '1:624990938618:web:50ee77224318c3ae4db043',
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);
