import React, { useState, useRef, useEffect } from 'react';
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
import { colors, spacing, radii } from '../../theme/theme';
import { useAuthStore } from '../../state/AuthStore';
import type { UserRole } from '../../models/UserRole';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const ROLES: { role: UserRole; icon: string; label: string; desc: string; gradient: string }[] = [
  { role: 'customer', icon: '\uD83D\uDE0B', label: 'Customer', desc: 'Order & enjoy', gradient: '#FF6B6B' },
  { role: 'admin', icon: '\uD83D\uDC51', label: 'Admin', desc: 'Manage all', gradient: '#845EF7' },
  { role: 'driver', icon: '\uD83D\uDEF5', label: 'Driver', desc: 'Deliver fast', gradient: '#20C997' },
];

/* ──── Floating Particle Bubble ──── */
const FloatingBubble: React.FC<{ delay: number; size: number; left: number; color: string }> = ({
  delay, size, left, color,
}) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0.12)).current;

  useEffect(() => {
    const float = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(translateY, { toValue: -SCREEN_H * 0.25, duration: 6000 + delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.25, duration: 3000, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(translateY, { toValue: 0, duration: 6000 + delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.12, duration: 3000, useNativeDriver: true }),
        ]),
      ]),
    );
    float.start();
    return () => float.stop();
  }, [translateY, opacity, delay]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        left,
        bottom: 40,
        opacity,
        transform: [{ translateY }],
      }}
    />
  );
};

/* ──── Custom Input ──── */
const AuthInput: React.FC<{
  icon: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: TextInput['props']['keyboardType'];
  autoCapitalize?: TextInput['props']['autoCapitalize'];
}> = ({ icon, placeholder, value, onChangeText, secureTextEntry, keyboardType, autoCapitalize }) => (
  <View style={styles.inputRow}>
    <Text style={styles.inputIcon}>{icon}</Text>
    <TextInput
      style={styles.inputField}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary + '90'}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize ?? 'none'}
    />
  </View>
);

/* ──── Main Screen ──── */
export const LoginScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { signIn, signUp, quickLogin, isLoading, error, user, role } = useAuthStore();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [roleSelection, setRoleSelection] = useState<UserRole>('customer');

  // Animations
  const heroScale = useRef(new Animated.Value(0.6)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(50)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const bubbleScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.parallel([
        Animated.spring(heroScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
        Animated.timing(heroOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
      Animated.spring(bubbleScale, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(contentSlide, { toValue: 0, duration: 700, easing: Easing.out(Easing.exp), useNativeDriver: true }),
        Animated.timing(contentFade, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  useEffect(() => {
    if (user && role) {
      const routes: Record<UserRole, string> = {
        customer: '/customer/home',
        admin: '/admin/dashboard',
        driver: '/driver/available',
      };
      router.replace(routes[role] as any);
    }
  }, [user, role, router]);

  const handleSubmit = async () => {
    if (mode === 'login') {
      await signIn(email.trim(), password);
    } else {
      if (!email.trim() || !password || !fullName.trim()) return;
      if (password.length < 6) return;
      await signUp(email.trim(), password, fullName.trim(), roleSelection);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Background particles */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <FloatingBubble delay={0} size={120} left={-30} color={colors.accent} />
        <FloatingBubble delay={800} size={80} left={SCREEN_W * 0.6} color="#845EF7" />
        <FloatingBubble delay={1500} size={60} left={SCREEN_W * 0.3} color="#20C997" />
        <FloatingBubble delay={600} size={100} left={SCREEN_W - 60} color="#FF6B6B" />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero Section ── */}
          <Animated.View style={[styles.heroSection, { opacity: heroOpacity, transform: [{ scale: heroScale }] }]}>
            <View style={styles.logoGlow}>
              <View style={styles.logoInner}>
                <Text style={styles.logoEmoji}>{'\uD83C\uDF54'}</Text>
              </View>
            </View>
            <Text style={styles.brandName}>GrillMe</Text>
            <Text style={styles.brandTag}>Fresh flavors, delivered fast</Text>
          </Animated.View>

          {/* ── Quick Access Cards ── */}
          <Animated.View style={{ transform: [{ scale: bubbleScale }] }}>
            <Text style={styles.sectionTitle}>Quick Access</Text>
            <View style={styles.quickRow}>
              {ROLES.map(r => (
                <Pressable
                  key={r.role}
                  style={({ pressed }) => [
                    styles.quickCard,
                    pressed && { transform: [{ scale: 0.94 }] },
                  ]}
                  onPress={() => quickLogin(r.role)}
                >
                  <View style={[styles.quickIconCircle, { backgroundColor: r.gradient + '18' }]}>
                    <Text style={styles.quickIcon}>{r.icon}</Text>
                  </View>
                  <Text style={styles.quickLabel}>{r.label}</Text>
                  <Text style={styles.quickDesc}>{r.desc}</Text>
                  <View style={[styles.quickDot, { backgroundColor: r.gradient }]} />
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* ── Divider ── */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or sign in with email</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Auth Card ── */}
          <Animated.View style={[styles.authCard, { opacity: contentFade, transform: [{ translateY: contentSlide }] }]}>
            {/* Tab Switcher */}
            <View style={styles.tabRow}>
              {(['login', 'signup'] as const).map(m => (
                <Pressable key={m} style={[styles.tab, mode === m && styles.tabActive]} onPress={() => setMode(m)}>
                  <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                    {m === 'login' ? 'Sign In' : 'Sign Up'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Fields */}
            {mode === 'signup' && (
              <AuthInput icon={'\uD83D\uDC64'} placeholder="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
            )}
            <AuthInput icon={'\uD83D\uDCE7'} placeholder="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <AuthInput icon={'\uD83D\uDD12'} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />

            {/* Role selector for signup */}
            {mode === 'signup' && (
              <View style={styles.roleSection}>
                <Text style={styles.roleTitle}>I am a...</Text>
                <View style={styles.roleRow}>
                  {ROLES.map(r => {
                    const selected = roleSelection === r.role;
                    return (
                      <Pressable
                        key={r.role}
                        style={[styles.roleChip, selected && { borderColor: r.gradient, backgroundColor: r.gradient + '12' }]}
                        onPress={() => setRoleSelection(r.role)}
                      >
                        <Text style={styles.roleChipIcon}>{r.icon}</Text>
                        <Text style={[styles.roleChipLabel, selected && { color: r.gradient }]}>{r.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorIcon}>{'\u26A0\uFE0F'}</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Submit */}
            <Pressable
              style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitText}>
                  {mode === 'login' ? 'Continue' : 'Create Account'}
                </Text>
              )}
            </Pressable>

            {mode === 'login' && (
              <Pressable style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            )}
          </Animated.View>

          {/* Footer */}
          <Text style={styles.footerText}>
            By continuing, you agree to our Terms of Service
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFE',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  /* ── Hero ── */
  heroSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoGlow: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  logoEmoji: { fontSize: 34 },
  brandName: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  brandTag: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    letterSpacing: 0.2,
  },

  /* ── Section title ── */
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },

  /* ── Quick cards ── */
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  quickCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F0F5',
  },
  quickIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickIcon: { fontSize: 26 },
  quickLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  quickDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  quickDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
  },

  /* ── Divider ── */
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8E8EF',
  },
  dividerText: {
    paddingHorizontal: 14,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  /* ── Auth Card ── */
  authCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F0F0F5',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#F5F5FA',
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
  },
  tab: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 11,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFF',
  },

  /* ── Input ── */
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7FC',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EDEDF3',
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    height: 50,
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },

  /* ── Role ── */
  roleSection: {
    marginBottom: 14,
  },
  roleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#EDEDF3',
    backgroundColor: '#F7F7FC',
    gap: 5,
  },
  roleChipIcon: { fontSize: 16 },
  roleChipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },

  /* ── Error ── */
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FFE0E0',
    gap: 8,
  },
  errorIcon: { fontSize: 16 },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },

  /* ── Submit ── */
  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  submitText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  forgotBtn: {
    alignItems: 'center',
    marginTop: 14,
  },
  forgotText: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },

  /* ── Footer ── */
  footerText: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 20,
    letterSpacing: 0.2,
  },
});

