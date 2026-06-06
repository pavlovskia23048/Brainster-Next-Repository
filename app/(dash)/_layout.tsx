import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function StackLayout() {
    const router = useRouter();
    const segments = useSegments();
    const { theme } = useTheme();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setIsAuthenticated(!!user);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (isAuthenticated === null) return;

        const inDashboard = segments[0] === '(dash)';

        if (!isAuthenticated && inDashboard) {
            router.replace('/(auth)/login');
        }
    }, [isAuthenticated, segments]);

    if (isAuthenticated === null) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return <Stack screenOptions={{ headerShown: false }} />;
}
