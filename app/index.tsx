import React, { useState, useEffect } from "react";
import { Redirect } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import GetStarted from "./(auth)/get-started";
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

const Page = () => {
  const { theme } = useTheme();
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    console.log('Setting up auth state listener...');

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
      setIsSignedIn(!!user);
      if (initializing) {
        setInitializing(false);
      }
    });

    return () => {
      console.log('Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  if (initializing || isSignedIn === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (isSignedIn) {
    console.log('User is signed in, redirecting to dashboard');
    return <Redirect href="/(dash)/(tabs)" />;
  }

  console.log('User not signed in, showing get started');
  return <GetStarted />;
};

export default Page;