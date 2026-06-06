import '../global.css';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import Toast from 'react-native-toast-message';
import { toastConfig } from '@/config/toastConfig';
import { requestNotificationPermissions } from '@/utils/notifications';
import { ThemeProvider } from '@/contexts/ThemeContext';

import { Stack } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { useEffect } from 'react';
import { Colors } from '@/constants/colors';
SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const [fontsLoaded] = useFonts({
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
      // Request notification permissions on app start
      requestNotificationPermissions();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return <ActivityIndicator size={"small"} />

  return (
    <ThemeProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: Colors.white
          }
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(dash)" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
      <Toast config={toastConfig} />
    </ThemeProvider>
  );
}
