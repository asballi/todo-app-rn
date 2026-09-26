import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { confirm, showError } from '../src/components/confirm';
import { getSyncService, useSyncState } from '../src/sync';
import { describeSync } from '../src/sync/describe';
import { isRemoteError } from '../src/sync/errors';
import { useNow } from '../src/store/hooks';
import { strings } from '../src/strings';
import { useThemedStyles, useTheme } from '../src/theme';

const t = strings.account;
const RESEND_SECONDS = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function errorText(e) {
  if (isRemoteError(e) && t.errors[e.kind]) return t.errors[e.kind];
  return e?.message ?? String(e);
}

// Ayarlar → Hesap (v4): giriş (e-posta → kod), durum, eşitleme, çıkış, hesabı sil.
export default function AccountScreen() {
  const styles = useThemedStyles(makeStyles);
  const state = useSyncState();

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: t.title }} />
      {!state.configured ? (
        <View style={styles.card}>
          <Text style={styles.text}>{t.notConfigured}</Text>
          <Text style={styles.help}>{t.notConfiguredHelp}</Text>
        </View>
      ) : !state.ready ? (
        <ActivityIndicator />
      ) : state.signedIn ? (
        <SignedIn state={state} />
      ) : (
        <>
          {state.sessionExpired && (
            <View style={styles.card}>
              <Text style={[styles.text, styles.warning]}>{t.expired}</Text>
              <SyncStatus sync={state.sync} />
            </View>
          )}
          <SignInForm />
          {state.sessionExpired && <SignOutButton />}
        </>
      )}
    </ScrollView>
  );
}

function SignInForm() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email'); // email | code
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [resendAt, setResendAt] = useState(0);
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    if (step !== 'code') return undefined;
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, [step]);
  const resendIn = Math.max(0, Math.ceil((resendAt - clock) / 1000));

  async function send() {
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError(t.invalidEmail);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await getSyncService().sendCode(value);
      setStep('code');
      setCode('');
      setResendAt(Date.now() + RESEND_SECONDS * 1000);
      setClock(Date.now());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!/^\d{6}$/.test(code.trim())) {
      setError(t.invalidCodeFormat);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await getSyncService().verifyCode(email, code);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.help}>{t.intro}</Text>
      {step === 'email' ? (
        <>
          <Text style={styles.label}>{t.email}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder={t.emailPlaceholder}
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            accessibilityLabel={t.email}
            onSubmitEditing={send}
            editable={!busy}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button label={t.sendCode} onPress={send} busy={busy} />
        </>
      ) : (
        <>
          <Text style={styles.text}>{t.codeSent(email.trim())}</Text>
          <Text style={styles.label}>{t.code}</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={code}
            onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 6))}
            placeholder={t.codePlaceholder}
            placeholderTextColor={colors.placeholder}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            accessibilityLabel={t.code}
            onSubmitEditing={verify}
            editable={!busy}
            maxLength={6}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button label={t.verify} onPress={verify} busy={busy} />
          <View style={styles.row}>
            <TouchableOpacity onPress={send} disabled={busy || resendIn > 0} accessibilityRole="button">
              <Text style={[styles.link, (busy || resendIn > 0) && styles.disabled]}>
                {resendIn > 0 ? t.resendIn(resendIn) : t.resend}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setStep('email');
                setError(null);
              }}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={styles.link}>{t.changeEmail}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

function SignedIn({ state }) {
  const styles = useThemedStyles(makeStyles);
  const [syncing, setSyncing] = useState(false);

  async function syncNow() {
    setSyncing(true);
    try {
      await getSyncService().syncNow();
    } finally {
      setSyncing(false);
    }
  }

  async function deleteAccount() {
    const first = await confirm({ title: t.deleteTitle, message: t.deleteMessage, confirmText: t.deleteAccount, destructive: true });
    if (!first) return;
    const second = await confirm({
      title: t.deleteConfirmTitle,
      message: t.deleteConfirmMessage,
      confirmText: t.deleteConfirm,
      destructive: true,
    });
    if (!second) return;
    try {
      await getSyncService().deleteAccount();
    } catch (e) {
      showError(new Error(errorText(e)));
    }
  }

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.text}>{t.signedInAs(state.email)}</Text>
        <SyncStatus sync={state.sync} />
        <Button label={t.syncNow} onPress={syncNow} busy={syncing || state.sync.phase === 'syncing'} />
      </View>
      <View style={styles.card}>
        <Text style={styles.help}>{t.signOutHelp}</Text>
        <SignOutButton />
      </View>
      <View style={styles.card}>
        <TouchableOpacity onPress={() => router.navigate('/settings')} accessibilityRole="button">
          <Text style={styles.link}>{t.backupFirst}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={deleteAccount} accessibilityRole="button">
          <Text style={styles.danger}>{t.deleteAccount}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      const service = getSyncService();
      const result = await service.signOut();
      if (!result.signedOut) {
        const ok = await confirm({
          title: t.signOutPendingTitle,
          message: t.signOutPending(result.pending),
          confirmText: t.signOutAnyway,
          destructive: true,
        });
        if (ok) await service.signOut({ force: true });
      }
    } catch (e) {
      showError(new Error(errorText(e)));
    } finally {
      setBusy(false);
    }
  }

  return <Button label={t.signOut} onPress={signOut} busy={busy} secondary />;
}

function SyncStatus({ sync }) {
  const styles = useThemedStyles(makeStyles);
  const now = useNow();
  return (
    <View style={styles.status} accessibilityLiveRegion="polite">
      {describeSync(sync, now).map(line => (
        <Text
          key={line.text}
          style={[styles.text, line.tone === 'error' && styles.error, line.tone === 'warning' && styles.warning]}
        >
          {line.text}
        </Text>
      ))}
    </View>
  );
}

function Button({ label, onPress, busy = false, secondary = false }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.button, secondary && styles.secondaryButton, busy && styles.disabled]}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      aria-busy={busy}
      aria-disabled={busy}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? colors.primary : colors.onPrimary} />
      ) : (
        <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = colors => StyleSheet.create({
  content: {
    padding: 20,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  text: {
    fontSize: 14,
    color: colors.text,
  },
  help: {
    fontSize: 13,
    color: colors.muted,
  },
  status: {
    gap: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  codeInput: {
    fontSize: 22,
    letterSpacing: 6,
  },
  error: {
    color: colors.danger,
  },
  // Renk kontrastı için metin rengi; vurgu kalınlıkla.
  warning: {
    color: colors.text,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
  danger: {
    color: colors.danger,
    fontWeight: '600',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonText: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: colors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
});
