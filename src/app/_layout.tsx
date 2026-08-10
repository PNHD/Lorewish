import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/auth/auth-context";
import { LocaleProvider } from "@/i18n";
import { useAppTheme } from "@/theme/use-app-theme";

function RootStack() {
  const { mode, colors } = useAppTheme();
  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <AuthProvider>
          <RootStack />
        </AuthProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
