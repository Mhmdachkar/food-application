import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/theme';
import { useAuthStore } from '../../state/AuthStore';
import type { UserRole } from '../../models/UserRole';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/* ── Role config ── */
const ROLES: { role: UserRole; icon: string; label: string; color: string; email: string; pw: string }[] = [
  { role: 'customer', icon: '\uD83D\uDE0B', label: 'Customer', color: '#FF6B6B', email: 'sarah@demo.com',  pw: 'Demo1234!' },
  { role: 'admin',    icon: '\uD83D\uDC51', label: 'Admin',    color: '#845EF7', email: 'alex@demo.com',   pw: 'Demo1234!' },
  { role: 'driver',   icon: '\uD83D\uDEF5', label: 'Driver',   color: '#20C997', email: 'james@demo.com',  pw: 'Demo1234!' },
];

/* ── Simple email regex ── */
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/* ──── Floating Particle ──── */
const FloatingBubble: React.FC<{ delay: number; size: number; left: number; color: string }> = ({
  delay, size, left, color,
}) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity    = useRef(new Animated.Value(0.08)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(translateY, { toValue: -SCREEN_H * 0.22, duration: 7000 + delay * 0.5, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(opacity,    { toValue: 0.18, duration: 3500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(translateY, { toValue: 0,    duration: 7000 + delay * 0.5, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(opacity,    { toValue: 0.08, duration: 3500, useNativeDriver: true }),
        ]),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View style={[styles.bubble, { width: size, height: size, borderRadius: size / 2, backgroundColor: color, left, opacity, transform: [{ translateY }] }]} />
  );
};

/* ──── Input field with focus highlight + optional eye toggle ──── */
const AuthInput = React.forwardRef<TextInput, {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: TextInput['props']['keyboardType'];
  autoCapitalize?: TextInput['props']['autoCapitalize'];
  error?: string;
  returnKeyType?: TextInput['props']['returnKeyType'];
  onSubmitEditing?: () => void;
  blurOnSubmit?: boolean;
}>(function AuthInputInner(
  { icon, placeholder, value, onChangeText, secureTextEntry, keyboardType, autoCapitalize, error, returnKeyType, onSubmitEditing, blurOnSubmit },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden]   = useState(secureTextEntry ?? false);
  const borderColor = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(borderColor, {
      toValue: focused ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [focused]);

  const animatedBorder = borderColor.interpolate({ inputRange: [0, 1], outputRange: ['#EDEDF3', colors.accent] });
  const animatedBg     = borderColor.interpolate({ inputRange: [0, 1], outputRange: ['#F7F7FC', '#FAFAFE'] });

  return (
    <View style={styles.inputWrap}>
      <Animated.View style={[styles.inputRow, { borderColor: animatedBorder, backgroundColor: animatedBg }]}>
        <Ionicons name={icon} size={18} color={focused ? colors.accent : '#9CA3AF'} style={styles.inputIcon} />
        <TextInput
          ref={ref}
          style={styles.inputField}
          placeholder={placeholder}
          placeholderTextColor="#B0B4C4"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'none'}
          autoCorrect={false}
          returnKeyType={returnKeyType ?? 'next'}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit ?? false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secureTextEntry && (
          <Pressable onPress={() => setHidden(h => !h)} hitSlop={8}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={18} color="#9CA3AF" />
          </Pressable>
        )}
      </Animated.View>
      {error ? (
        <View style={styles.fieldError}>
          <Ionicons name="alert-circle-outline" size={13} color={colors.danger} />
          <Text style={styles.fieldErrorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
});

/* ──── Demo account card ──── */
const DemoCard: React.FC<{ role: typeof ROLES[number]; onPress: () => void; loading: boolean }> = ({ role, onPress, loading }) => {
  const [pressed, setPressedState] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn  = () => { setPressedState(true);  Animated.spring(scale, { toValue: 0.94, friction: 8, useNativeDriver: true }).start(); };
  const handlePressOut = () => { setPressedState(false); Animated.spring(scale, { toValue: 1,    friction: 8, useNativeDriver: true }).start(); };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} disabled={loading}>
      <Animated.View style={[styles.demoCard, { transform: [{ scale }] }]}>
        <View style={[styles.demoIconCircle, { backgroundColor: role.color + '18' }]}>
          <Text style={styles.demoIcon}>{role.icon}</Text>
        </View>
        <Text style={styles.demoLabel}>{role.label}</Text>
        <View style={[styles.demoDot, { backgroundColor: role.color }]} />
        {loading
          ? <ActivityIndicator size="small" color={role.color} style={{ marginTop: 6 }} />
          : <Text style={styles.demoEmail} numberOfLines={1}>{role.email}</Text>
        }
      </Animated.View>
    </Pressable>
  );
};

/* ──── Social button (placeholder) ──── */
const SocialBtn: React.FC<{ icon: keyof typeof Ionicons.glyphMap; label: string }> = ({ icon, label }) => (
  <Pressable style={styles.socialBtn}>
    <Ionicons name={icon} size={20} color={colors.textPrimary} />
    <Text style={styles.socialBtnText}>{label}</Text>
  </Pressable>
);

/* ═══════════════════════ Main Screen ═══════════════════════ */
export const LoginScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { signIn, signUp, quickLogin, isLoading, error, user, role } = useAuthStore();
  const router = useRouter();

  const [mode, setMode]                 = useState<'login' | 'signup'>('login');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [fullName, setFullName]         = useState('');
  const [roleSelection, setRoleSelection] = useState<UserRole>('customer');
  const [quickLoadingRole, setQLRole]   = useState<UserRole | null>(null);

  /* Per-field validation errors */
  const [nameErr,  setNameErr]  = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [pwErr,    setPwErr]    = useState('');

  /* Refs for auto-focus chaining */
  const emailRef    = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const nameRef     = useRef<TextInput>(null);

  /* Entrance animations */
  const heroScale    = useRef(new Animated.Value(0.7)).current;
  const heroOpacity  = useRef(new Animated.Value(0)).current;
  const cardSlide    = useRef(new Animated.Value(60)).current;
  const cardFade     = useRef(new Animated.Value(0)).current;
  const demoScale    = useRef(new Animated.Value(0.8)).current;
  const demoFade     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.parallel([
        Animated.spring(heroScale,   { toValue: 1, friction: 6, tension: 55, useNativeDriver: true }),
        Animated.timing(heroOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(demoScale, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
        Animated.timing(demoFade,  { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardSlide, { toValue: 0, duration: 600, easing: Easing.out(Easing.exp), useNativeDriver: true }),
        Animated.timing(cardFade,  { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  /* Redirect after login */
  useEffect(() => {
    if (user && role) {
      const routes: Record<UserRole, string> = {
        customer: '/customer/home',
        admin: '/admin/dashboard',
        driver: '/driver/available',
      };
      router.replace(routes[role] as any);
    }
  }, [user, role]);

  /* Clear errors on input change */
  const clearErrors = () => { setNameErr(''); setEmailErr(''); setPwErr(''); };

  /* Mode switch — clear fields + errors */
  const switchMode = (m: 'login' | 'signup') => {
    setMode(m);
    clearErrors();
    setEmail(''); setPassword(''); setFullName('');
  };

  /* Validate then submit */
  const handleSubmit = useCallback(async () => {
    clearErrors();
    let valid = true;

    if (mode === 'signup' && !fullName.trim()) {
      setNameErr('Full name is required'); valid = false;
    }
    if (!isValidEmail(email)) {
      setEmailErr('Enter a valid email address'); valid = false;
    }
    if (password.length < 6) {
      setPwErr('Password must be at least 6 characters'); valid = false;
    }
    if (!valid) return;

    if (mode === 'login') {
      await signIn(email.trim(), password);
    } else {
      await signUp(email.trim(), password, fullName.trim(), roleSelection);
    }
  }, [mode, email, password, fullName, roleSelection, signIn, signUp]);

  const handleQuickLogin = async (r: typeof ROLES[number]) => {
    setQLRole(r.role);
    await quickLogin(r.role);
    setQLRole(null);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Background particles */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <FloatingBubble delay={0}    size={130} left={-40}          color={colors.accent} />
        <FloatingBubble delay={900}  size={90}  left={SCREEN_W * 0.6} color="#845EF7" />
        <FloatingBubble delay={1600} size={65}  left={SCREEN_W * 0.28} color="#20C997" />
        <FloatingBubble delay={500}  size={110} left={SCREEN_W - 55} color="#FF6B6B" />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ── */}
          <Animated.View style={[styles.heroSection, { opacity: heroOpacity, transform: [{ scale: heroScale }] }]}>
            <View style={styles.logoRing}>
              <View style={styles.logoGlow}>
                <View style={styles.logoInner}>
                  <Text style={styles.logoEmoji}>{'\uD83C\uDF54'}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.brandName}>GrillMe</Text>
            <Text style={styles.brandTag}>Fresh flavors, delivered fast</Text>
          </Animated.View>

          {/* ── Demo access ── */}
          <Animated.View style={{ opacity: demoFade, transform: [{ scale: demoScale }] }}>
            <View style={styles.demoHeader}>
              <View style={styles.demoBadge}>
                <Text style={styles.demoBadgeText}>DEMO</Text>
              </View>
              <Text style={styles.demoTitle}>Quick Access</Text>
            </View>
            <View style={styles.demoRow}>
              {ROLES.map(r => (
                <DemoCard
                  key={r.role}
                  role={r}
                  onPress={() => handleQuickLogin(r)}
                  loading={quickLoadingRole === r.role}
                />
              ))}
            </View>
          </Animated.View>

          {/* ── Divider ── */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with email</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Auth Card ── */}
          <Animated.View style={[styles.authCard, { opacity: cardFade, transform: [{ translateY: cardSlide }] }]}>

            {/* Tab switcher */}
            <View style={styles.tabRow}>
              {(['login', 'signup'] as const).map(m => (
                <Pressable key={m} style={[styles.tab, mode === m && styles.tabActive]} onPress={() => switchMode(m)}>
                  <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                    {m === 'login' ? 'Sign In' : 'Create Account'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Fields */}
            {mode === 'signup' && (
              <AuthInput
                ref={nameRef}
                icon="person-outline"
                placeholder="Full name"
                value={fullName}
                onChangeText={t => { setFullName(t); if (nameErr) setNameErr(''); }}
                autoCapitalize="words"
                error={nameErr}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            )}
            <AuthInput
              ref={emailRef}
              icon="mail-outline"
              placeholder="Email address"
              value={email}
              onChangeText={t => { setEmail(t); if (emailErr) setEmailErr(''); }}
              keyboardType="email-address"
              error={emailErr}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <AuthInput
              ref={passwordRef}
              icon="lock-closed-outline"
              placeholder="Password"
              value={password}
              onChangeText={t => { setPassword(t); if (pwErr) setPwErr(''); }}
              secureTextEntry
              error={pwErr}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              blurOnSubmit
            />

            {/* Role picker (signup only) */}
            {mode === 'signup' && (
              <View style={styles.roleSection}>
                <Text style={styles.roleTitle}>I want to…</Text>
                <View style={styles.roleRow}>
                  {ROLES.map(r => {
                    const sel = roleSelection === r.role;
                    return (
                      <Pressable
                        key={r.role}
                        style={[styles.roleChip, sel && { borderColor: r.color, backgroundColor: r.color + '12' }]}
                        onPress={() => setRoleSelection(r.role)}
                      >
                        <Text style={styles.roleChipIcon}>{r.icon}</Text>
                        <Text style={[styles.roleChipLabel, sel && { color: r.color }]}>{r.label}</Text>
                        {sel && <Ionicons name="checkmark-circle" size={14} color={r.color} style={{ marginLeft: 2 }} />}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Global API error */}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Submit */}
            <Pressable
              style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }, isLoading && styles.submitBtnLoading]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <View style={styles.submitLoading}>
                  <ActivityIndicator color="#FFF" size="small" />
                  <Text style={styles.submitText}>{mode === 'login' ? 'Signing in…' : 'Creating account…'}</Text>
                </View>
              ) : (
                <Text style={styles.submitText}>
                  {mode === 'login' ? 'Sign In' : 'Create Account'} →
                </Text>
              )}
            </Pressable>

            {mode === 'login' && (
              <Pressable style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            )}
          </Animated.View>

          {/* ── Social login (visual placeholder) ── */}
          <View style={styles.socialSection}>
            <SocialBtn icon="logo-google" label="Continue with Google" />
            <SocialBtn icon="logo-apple"  label="Continue with Apple"  />
          </View>

          {/* ── Footer ── */}
          <View style={styles.footerRow}>
            <Ionicons name="shield-checkmark-outline" size={13} color="#9CA3AF" />
            <Text style={styles.footerText}>Secured · By continuing, you agree to our Terms</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

/* ══════════════════ Styles ══════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FF' },
  scrollContent: { paddingHorizontal: 22, paddingTop: 8 },

  bubble: { position: 'absolute', bottom: 40 },

  /* ── Hero ── */
  heroSection: { alignItems: 'center', marginBottom: 24 },
  logoRing: {
    width: 112, height: 112, borderRadius: 56,
    borderWidth: 1, borderColor: colors.accent + '20',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  logoGlow: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.accent + '14',
    alignItems: 'center', justifyContent: 'center',
  },
  logoInner: {
    width: 74, height: 74, borderRadius: 37,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  logoEmoji: { fontSize: 36 },
  brandName: { fontSize: 34, fontWeight: '900', color: colors.textPrimary, letterSpacing: -1.2 },
  brandTag:  { fontSize: 14, color: colors.textSecondary, marginTop: 4, letterSpacing: 0.2 },

  /* ── Demo Cards ── */
  demoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  demoBadge: { backgroundColor: '#FFF0D9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  demoBadgeText: { fontSize: 10, fontWeight: '800', color: '#D97706', letterSpacing: 1 },
  demoTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  demoRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  demoCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 20, paddingVertical: 16, paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3,
    borderWidth: 1, borderColor: '#F0F0F5',
  },
  demoIconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  demoIcon:  { fontSize: 26 },
  demoLabel: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  demoDot:   { width: 5, height: 5, borderRadius: 3, marginTop: 6, marginBottom: 4 },
  demoEmail: { fontSize: 9, color: colors.textSecondary, fontWeight: '500', textAlign: 'center', maxWidth: 90 },

  /* ── Divider ── */
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E8E8EF' },
  dividerText: { paddingHorizontal: 14, fontSize: 12, color: colors.textSecondary, fontWeight: '500' },

  /* ── Auth Card ── */
  authCard: {
    backgroundColor: '#FFF', borderRadius: 26, padding: 22,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },
    elevation: 6, borderWidth: 1, borderColor: '#F0F0F5',
    marginBottom: 14,
  },
  tabRow: { flexDirection: 'row', backgroundColor: '#F5F5FA', borderRadius: 14, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 11, alignItems: 'center' },
  tabActive: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  tabText:       { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  /* ── Input ── */
  inputWrap: { marginBottom: 12 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, paddingHorizontal: 14,
    borderWidth: 1.5,
  },
  inputIcon:  { marginRight: 10 },
  inputField: { flex: 1, height: 52, fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
  fieldError: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5, marginLeft: 4 },
  fieldErrorText: { fontSize: 12, color: colors.danger, fontWeight: '500' },

  /* ── Role Picker ── */
  roleSection: { marginBottom: 14 },
  roleTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
  roleRow: { flexDirection: 'row', gap: 8 },
  roleChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#EDEDF3',
    backgroundColor: '#F7F7FC', gap: 4,
  },
  roleChipIcon:  { fontSize: 15 },
  roleChipLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },

  /* ── Error ── */
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#FFF5F5', borderRadius: 12, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: '#FFE0E0', gap: 8,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: '500', lineHeight: 18 },

  /* ── Submit ── */
  submitBtn: {
    backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginTop: 4,
    shadowColor: colors.accent, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 6,
  },
  submitBtnLoading: { backgroundColor: colors.accent + 'CC' },
  submitLoading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  submitText: { color: '#FFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  forgotBtn: { alignItems: 'center', marginTop: 16 },
  forgotText: { fontSize: 13, color: colors.accent, fontWeight: '600' },

  /* ── Social ── */
  socialSection: { gap: 10, marginBottom: 18 },
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: '#FFF', borderRadius: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: '#E8E8EF',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  socialBtnText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },

  /* ── Footer ── */
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  footerText: { fontSize: 11, color: '#9CA3AF', letterSpacing: 0.2 },
});
