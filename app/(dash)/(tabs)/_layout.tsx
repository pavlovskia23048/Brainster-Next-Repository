import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';
import { useMemo } from 'react';

export default function TabLayout() {
    const { theme, isDark } = useTheme();
    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: theme.tabBarActive,
                tabBarInactiveTintColor: theme.tabBarInactive,
                tabBarLabelStyle: styles.tabBarLabel,
                tabBarItemStyle: styles.tabBarItem,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="home-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="workouts"
                options={{
                    title: 'Workouts',
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="dumbbell" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="challenges"
                options={{
                    title: 'Challenges',
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="trophy-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="progress"
                options={{
                    title: 'Progress',
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="chart-line" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="account-outline" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}

const createStyles = (theme: ThemeColors, isDark: boolean) => StyleSheet.create({
    tabBar: {
        position: 'absolute',
        bottom: 20,
        left: '7.5%',
        right: '7.5%',
        height: 72,
        backgroundColor: theme.tabBarBackground,
        borderRadius: 36,
        paddingBottom: 8,
        paddingTop: 8,
        shadowColor: theme.shadow,
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: isDark ? 0.3 : 0.12,
        shadowRadius: 20,
        elevation: 10,
        borderTopWidth: 0,
        borderWidth: 1,
        borderColor: theme.border,
    },
    tabBarLabel: {
        fontSize: 11,
        lineHeight: 14,
        fontWeight: '600',
        marginTop: 2,
        marginBottom: 0,
        includeFontPadding: false,
    },
    tabBarItem: {
        paddingTop: 2,
        paddingBottom: 0,
    },
});