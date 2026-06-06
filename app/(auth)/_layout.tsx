import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

export default function StackLayout() {
    const { theme, isDark } = useTheme();

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="get-started" />
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
        </Stack>
    );
}
