import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type AuthErrorCode, useAuth } from "@/auth/auth-context";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";
import { interactiveState, radius, readingWidth, spacing } from "@/theme/tokens";
import { useAppTheme } from "@/theme/use-app-theme";

type FormMode = "sign_in" | "sign_up";
type ScreenState = "form" | "check_email";

const ERROR_KEYS: Record<AuthErrorCode, string> = {
  invalid_credentials: "account.errorInvalidCredentials",
  email_not_confirmed: "account.errorEmailNotConfirmed",
  user_already_exists: "account.errorUserAlreadyExists",
  weak_password: "account.errorWeakPassword",
  invalid_email: "account.errorInvalidEmail",
  unknown: "account.errorUnknown",
};

function TextField({
  label,
  value,
  onChangeText,
  secureTextEntry,
  autoCapitalize = "none",
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences";
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: spacing.xs, width: "100%" }}>
      <ThemedText variant="caption" color="secondary">
        {label}
      </ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          color: colors.textPrimary,
          borderRadius: radius.sm,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          fontSize: 16,
        }}
        placeholderTextColor={colors.textSecondary}
      />
    </View>
  );
}

function SubmitButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colors.accent,
        borderRadius: radius.pill,
        paddingVertical: spacing.md,
        alignItems: "center",
        opacity: disabled ? interactiveState.disabledOpacity : pressed ? interactiveState.pressedOpacity : 1,
      })}
    >
      <ThemedText variant="label" color="onAccent">
        {label}
      </ThemedText>
    </Pressable>
  );
}

function AuthForm() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<FormMode>("sign_in");
  const [screenState, setScreenState] = useState<ScreenState>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null);
  const [confirmedEmail, setConfirmedEmail] = useState("");

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorCode(null);
    const trimmedEmail = email.trim();
    const result = mode === "sign_in" ? await signIn(trimmedEmail, password) : await signUp(trimmedEmail, password);
    setSubmitting(false);

    if (result.kind === "error") {
      setErrorCode(result.code);
      return;
    }
    if (result.kind === "check_email") {
      setConfirmedEmail(trimmedEmail);
      setScreenState("check_email");
      setPassword("");
    }
    // "signed_in" needs no local handling — AuthProvider's session listener
    // flips the parent screen to the signed-in view.
  };

  if (screenState === "check_email") {
    return (
      <View style={{ gap: spacing.lg, width: "100%", alignItems: "center" }}>
        <ThemedText variant="heading" style={{ textAlign: "center" }}>
          {t("account.checkEmailHeading")}
        </ThemedText>
        <ThemedText variant="body" color="secondary" style={{ textAlign: "center" }}>
          {t("account.checkEmailBody", { email: confirmedEmail })}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setScreenState("form");
            setMode("sign_in");
          }}
        >
          <ThemedText variant="label" color="secondary">
            {t("account.backToSignIn")}
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.lg, width: "100%" }}>
      <View style={{ flexDirection: "row", borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
        {(["sign_in", "sign_up"] as const).map((candidate) => (
          <Pressable
            key={candidate}
            accessibilityRole="button"
            onPress={() => {
              setMode(candidate);
              setErrorCode(null);
            }}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              alignItems: "center",
              backgroundColor: mode === candidate ? colors.accent : "transparent",
            }}
          >
            <ThemedText variant="label" color={mode === candidate ? "onAccent" : "primary"}>
              {t(candidate === "sign_in" ? "account.signInTab" : "account.signUpTab")}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <TextField label={t("account.emailLabel")} value={email} onChangeText={setEmail} />
      <TextField label={t("account.passwordLabel")} value={password} onChangeText={setPassword} secureTextEntry />

      {errorCode && (
        <ThemedText variant="caption" color="danger">
          {t(ERROR_KEYS[errorCode])}
        </ThemedText>
      )}

      <SubmitButton
        label={submitting ? t("account.loading") : t(mode === "sign_in" ? "account.signInSubmit" : "account.signUpSubmit")}
        onPress={handleSubmit}
        disabled={!canSubmit}
      />

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setMode(mode === "sign_in" ? "sign_up" : "sign_in");
          setErrorCode(null);
        }}
      >
        <ThemedText variant="caption" color="secondary" style={{ textAlign: "center" }}>
          {t(mode === "sign_in" ? "account.switchToSignUp" : "account.switchToSignIn")}
        </ThemedText>
      </Pressable>

      <ThemedText variant="caption" color="secondary" style={{ textAlign: "center" }}>
        {t("account.guestNotice")}
      </ThemedText>
    </View>
  );
}

function SignedInView() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutFailed(false);
    const result = await signOut();
    setSigningOut(false);
    if (result.kind === "error") {
      setSignOutFailed(true);
    }
  };

  return (
    <View style={{ gap: spacing.lg, width: "100%", alignItems: "center" }}>
      <ThemedText variant="body" style={{ textAlign: "center" }}>
        {user?.is_anonymous ? t("account.guestSession") : t("account.signedInAs", { email: user?.email ?? "" })}
      </ThemedText>
      {user?.is_anonymous && <ThemedText variant="caption" color="secondary" style={{ textAlign: "center" }}>{t("account.guestPersistence")}</ThemedText>}
      {signOutFailed && (
        <ThemedText variant="caption" color="danger">
          {t("account.signOutError")}
        </ThemedText>
      )}
      {!user?.is_anonymous && <SubmitButton
        label={signingOut ? t("account.loading") : t("account.signOut")}
        onPress={handleSignOut}
        disabled={signingOut}
      />}
    </View>
  );
}

export function AccountScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { status } = useAuth();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Link href="/" accessibilityRole="link">
          <ThemedText variant="label" color="secondary">
            {"‹ "}
            {t("account.backToHome")}
          </ThemedText>
        </Link>
        <LanguageSwitcher />
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
        <View style={{ maxWidth: readingWidth.maxContentWidth, width: "100%", gap: spacing.xl }}>
          <ThemedText variant="display" style={{ textAlign: "center" }}>
            {t("account.screenTitle")}
          </ThemedText>

          {status === "loading" && (
            <ThemedText variant="body" color="secondary" style={{ textAlign: "center" }}>
              {t("account.loading")}
            </ThemedText>
          )}
          {status === "signed_out" && <AuthForm />}
          {status === "signed_in" && <SignedInView />}
        </View>
      </View>
    </SafeAreaView>
  );
}
