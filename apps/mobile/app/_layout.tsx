import React from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@clerk/clerk-expo';
import { ConvexClerkProvider } from '../src/providers/ConvexClerkProvider';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../src/theme/colors';
import { usePushNotifications } from '../src/hooks/usePushNotifications';

function PushRegistration() {
  usePushNotifications();
  return null;
}

function AuthGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === '(tabs)';

    if (isSignedIn && !inAuthGroup) {
      router.replace('/(tabs)');
    } else if (!isSignedIn && inAuthGroup) {
      router.replace('/sign-in');
    }
  }, [isLoaded, isSignedIn, segments]);

  if (!isLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      {isSignedIn && <PushRegistration />}
      <Slot />
    </>
  );
}

export default function RootLayout() {
  return (
    <ConvexClerkProvider>
      <StatusBar style="light" />
      <AuthGate />
    </ConvexClerkProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
});
