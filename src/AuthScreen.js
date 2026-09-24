import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from './firebase';
import { authErrorMessage } from './authErrorMessage';

const MODES = {
  login: { title: 'Giriş yap', button: 'Giriş yap' },
  register: { title: 'Hesap oluştur', button: 'Kayıt ol' },
  reset: { title: 'Şifremi unuttum', button: 'Sıfırlama bağlantısı gönder' },
};

export default function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  function switchMode(next) {
    setMode(next);
    setError('');
    setInfo('');
  }

  async function submit() {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const trimmedEmail = email.trim();
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      } else if (mode === 'register') {
        await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      } else {
        await sendPasswordResetEmail(auth, trimmedEmail);
        setInfo('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.');
      }
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ecebff" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <Text style={styles.appName}>Yapılacaklar</Text>
          <Text style={styles.title}>{MODES[mode].title}</Text>

          <TextInput
            style={styles.input}
            placeholder="E-posta"
            placeholderTextColor="#bbb"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType={mode === 'reset' ? 'send' : 'next'}
            onSubmitEditing={mode === 'reset' ? submit : undefined}
          />
          {mode !== 'reset' && (
            <TextInput
              style={styles.input}
              placeholder="Şifre"
              placeholderTextColor="#bbb"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}
          {!!info && <Text style={styles.info}>{info}</Text>}

          <TouchableOpacity style={styles.button} onPress={submit} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{MODES[mode].button}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.links}>
            {mode === 'login' && (
              <>
                <TouchableOpacity onPress={() => switchMode('register')}>
                  <Text style={styles.link}>Hesabın yok mu? Kayıt ol</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => switchMode('reset')}>
                  <Text style={styles.linkMuted}>Şifremi unuttum</Text>
                </TouchableOpacity>
              </>
            )}
            {mode !== 'login' && (
              <TouchableOpacity onPress={() => switchMode('login')}>
                <Text style={styles.link}>Girişe dön</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#ecebff',
  },
  flex: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  appName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a1a2e',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  input: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#2d2d2d',
    backgroundColor: '#fafafa',
    marginBottom: 12,
  },
  error: {
    color: '#e05c5c',
    fontSize: 13,
    marginBottom: 12,
  },
  info: {
    color: '#2e9e5b',
    fontSize: 13,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#6c63ff',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  links: {
    marginTop: 16,
    alignItems: 'center',
    gap: 10,
  },
  link: {
    color: '#6c63ff',
    fontSize: 14,
    fontWeight: '500',
  },
  linkMuted: {
    color: '#999',
    fontSize: 13,
  },
});
