import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native';
import React, { useState, useEffect, useMemo } from 'react';
import { Text } from '@/components/common/Text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeBack } from '@/utils/navigation';
import { auth } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';
import Toast from 'react-native-toast-message';
import { getSubscriptionStatus, activateSubscription, cancelSubscription, resetGenerationCounter, simulateGenerationsUsed, resetToFree, SubscriptionStatus } from '@/services/subscriptionService';

const FREE_FEATURES = [
    { text: 'Manual workout tracking', included: true },
    { text: 'Gamification (30 levels, streaks)', included: true },
    { text: 'Social features & leaderboard', included: true },
    { text: 'Progress charts & stats', included: true },
    { text: '3 AI plan generations / month', included: true },
    { text: 'Unlimited AI plan generations', included: false },
    { text: 'Advanced analytics', included: false },
    { text: 'Priority support', included: false },
];

const PREMIUM_FEATURES = [
    { text: 'Everything in Free', included: true },
    { text: 'Unlimited AI plan generations', included: true },
    { text: 'Advanced analytics & insights', included: true },
    { text: 'Priority support', included: true },
    { text: 'Early access to new features', included: true },
];

export default function Subscription() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

    const [status, setStatus] = useState<SubscriptionStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [activating, setActivating] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');

    useEffect(() => {
        loadStatus();
    }, []);

    const loadStatus = async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            const sub = await getSubscriptionStatus(user.uid);
            setStatus(sub);
        } catch (error) {
            console.error('Error loading subscription:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubscribe = async () => {
        const user = auth.currentUser;
        if (!user) return;

        setActivating(true);
        try {
            await activateSubscription(user.uid, selectedPlan);
            await loadStatus();
            Toast.show({
                type: 'success',
                text1: 'Welcome to Premium!',
                text2: 'You now have unlimited AI plan generations.',
                position: 'top',
            });
        } catch (error: any) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error?.message || 'Failed to activate subscription',
                position: 'top',
            });
        } finally {
            setActivating(false);
        }
    };

    const handleCancel = async () => {
        const user = auth.currentUser;
        if (!user) return;

        setActivating(true);
        try {
            await cancelSubscription(user.uid);
            await loadStatus();
            Toast.show({
                type: 'success',
                text1: 'Subscription Cancelled',
                text2: 'You are now on the free plan.',
                position: 'top',
            });
        } catch (error: any) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error?.message || 'Failed to cancel subscription',
                position: 'top',
            });
        } finally {
            setActivating(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    const isPremium = status?.tier === 'premium';

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router)}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Subscription</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {isPremium ? (
                    /* Premium Active State */
                    <View style={styles.premiumActiveCard}>
                        <MaterialCommunityIcons name="crown" size={48} color="#FFD700" />
                        <Text style={styles.premiumActiveTitle}>Premium Active</Text>
                        <Text style={styles.premiumActiveSubtitle}>
                            You have unlimited access to all AI features.
                        </Text>
                        {status?.subscriptionExpiry && (
                            <Text style={styles.expiryText}>
                                Expires: {status.subscriptionExpiry.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </Text>
                        )}
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={handleCancel}
                            disabled={activating}
                        >
                            <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {/* Usage Info */}
                        <View style={styles.usageCard}>
                            <Text style={styles.usageTitle}>AI Plan Generations</Text>
                            <View style={styles.usageBar}>
                                <View style={[styles.usageFill, { width: `${((status?.monthlyGenerationsUsed || 0) / 3) * 100}%` }]} />
                            </View>
                            <Text style={styles.usageText}>
                                {status?.monthlyGenerationsUsed || 0} / 3 used this month
                            </Text>
                        </View>

                        {/* Upgrade Header */}
                        <View style={styles.upgradeHeader}>
                            <MaterialCommunityIcons name="rocket-launch" size={32} color={theme.accent} />
                            <Text style={styles.upgradeTitle}>Upgrade to Premium</Text>
                            <Text style={styles.upgradeSubtitle}>
                                Unlock unlimited AI workout plan generations and advanced features.
                            </Text>
                        </View>

                        {/* Plan Selection */}
                        <View style={styles.plansContainer}>
                            <TouchableOpacity
                                style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
                                onPress={() => setSelectedPlan('monthly')}
                            >
                                <View style={styles.planHeader}>
                                    <Text style={[styles.planName, selectedPlan === 'monthly' && styles.planNameSelected]}>Monthly</Text>
                                    <View style={[styles.radioOuter, selectedPlan === 'monthly' && styles.radioOuterSelected]}>
                                        {selectedPlan === 'monthly' && <View style={styles.radioInner} />}
                                    </View>
                                </View>
                                <Text style={[styles.planPrice, selectedPlan === 'monthly' && styles.planPriceSelected]}>$4.99</Text>
                                <Text style={[styles.planPeriod, selectedPlan === 'monthly' && styles.planPeriodSelected]}>per month</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.planCard, selectedPlan === 'yearly' && styles.planCardSelected]}
                                onPress={() => setSelectedPlan('yearly')}
                            >
                                <View style={styles.saveBadge}>
                                    <Text style={styles.saveBadgeText}>Save 33%</Text>
                                </View>
                                <View style={styles.planHeader}>
                                    <Text style={[styles.planName, selectedPlan === 'yearly' && styles.planNameSelected]}>Yearly</Text>
                                    <View style={[styles.radioOuter, selectedPlan === 'yearly' && styles.radioOuterSelected]}>
                                        {selectedPlan === 'yearly' && <View style={styles.radioInner} />}
                                    </View>
                                </View>
                                <Text style={[styles.planPrice, selectedPlan === 'yearly' && styles.planPriceSelected]}>$39.99</Text>
                                <Text style={[styles.planPeriod, selectedPlan === 'yearly' && styles.planPeriodSelected]}>per year ($3.33/mo)</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Features Comparison */}
                        <View style={styles.featuresSection}>
                            <Text style={styles.featuresTitle}>What you get with Premium</Text>
                            {PREMIUM_FEATURES.map((feature, index) => (
                                <View key={index} style={styles.featureRow}>
                                    <MaterialCommunityIcons name="check-circle" size={20} color={theme.success} />
                                    <Text style={styles.featureText}>{feature.text}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Subscribe Button */}
                        <View style={styles.subscribeContainer}>
                            <TouchableOpacity
                                style={styles.subscribeButton}
                                onPress={handleSubscribe}
                                disabled={activating}
                            >
                                {activating ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <MaterialCommunityIcons name="crown" size={20} color="#FFFFFF" />
                                        <Text style={styles.subscribeText}>
                                            Subscribe for {selectedPlan === 'monthly' ? '$4.99/mo' : '$39.99/yr'}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                            <Text style={styles.disclaimer}>
                                This is a simulated subscription for demonstration purposes. In production, payments would be processed via RevenueCat with App Store and Google Play.
                            </Text>
                        </View>
                    </>
                )}

                {/* Demo Controls for Testing */}
                <View style={styles.demoSection}>
                    <View style={styles.demoBorder}>
                        <View style={styles.demoHeader}>
                            <MaterialCommunityIcons name="test-tube" size={18} color={theme.textTertiary} />
                            <Text style={styles.demoTitle}>Demo Controls</Text>
                        </View>
                        <Text style={styles.demoDesc}>
                            These controls simulate payment operations for testing. In production, payments are handled by RevenueCat.
                        </Text>

                        <TouchableOpacity
                            style={styles.demoButton}
                            disabled={activating}
                            onPress={async () => {
                                const user = auth.currentUser;
                                if (!user) return;
                                setActivating(true);
                                try {
                                    await activateSubscription(user.uid, 'monthly');
                                    await loadStatus();
                                    Toast.show({ type: 'success', text1: 'Demo: Premium activated (30 days)', position: 'top' });
                                } catch { } finally { setActivating(false); }
                            }}
                        >
                            <MaterialCommunityIcons name="crown" size={16} color={theme.success} />
                            <Text style={styles.demoButtonText}>Activate Premium (Demo)</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.demoButton}
                            disabled={activating}
                            onPress={async () => {
                                const user = auth.currentUser;
                                if (!user) return;
                                setActivating(true);
                                try {
                                    await resetToFree(user.uid);
                                    await loadStatus();
                                    Toast.show({ type: 'success', text1: 'Demo: Reset to free tier', position: 'top' });
                                } catch { } finally { setActivating(false); }
                            }}
                        >
                            <MaterialCommunityIcons name="restart" size={16} color={theme.textSecondary} />
                            <Text style={styles.demoButtonText}>Reset to Free (Demo)</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.demoButton}
                            disabled={activating}
                            onPress={async () => {
                                const user = auth.currentUser;
                                if (!user) return;
                                setActivating(true);
                                try {
                                    await simulateGenerationsUsed(user.uid, 3);
                                    await loadStatus();
                                    Toast.show({ type: 'success', text1: 'Demo: Set 3/3 generations used', position: 'top' });
                                } catch { } finally { setActivating(false); }
                            }}
                        >
                            <MaterialCommunityIcons name="numeric-3-circle" size={16} color={theme.warning || '#F59E0B'} />
                            <Text style={styles.demoButtonText}>Simulate 3 Generations Used</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.demoButton}
                            disabled={activating}
                            onPress={async () => {
                                const user = auth.currentUser;
                                if (!user) return;
                                setActivating(true);
                                try {
                                    await resetGenerationCounter(user.uid);
                                    await loadStatus();
                                    Toast.show({ type: 'success', text1: 'Demo: Generation counter reset to 0', position: 'top' });
                                } catch { } finally { setActivating(false); }
                            }}
                        >
                            <MaterialCommunityIcons name="counter" size={16} color={theme.primary} />
                            <Text style={styles.demoButtonText}>Reset Generations Counter</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
}

const createStyles = (theme: ThemeColors, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    centerContent: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: theme.card,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.text,
    },
    scrollView: {
        flex: 1,
    },
    premiumActiveCard: {
        alignItems: 'center',
        backgroundColor: theme.card,
        margin: 20,
        borderRadius: 20,
        padding: 32,
        borderWidth: 2,
        borderColor: '#FFD700',
    },
    premiumActiveTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: theme.text,
        marginTop: 16,
    },
    premiumActiveSubtitle: {
        fontSize: 14,
        color: theme.textSecondary,
        textAlign: 'center',
        marginTop: 8,
    },
    expiryText: {
        fontSize: 13,
        color: theme.textTertiary,
        marginTop: 12,
    },
    cancelButton: {
        marginTop: 24,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.textSecondary,
    },
    usageCard: {
        backgroundColor: theme.card,
        margin: 20,
        marginBottom: 0,
        borderRadius: 16,
        padding: 20,
        borderWidth: isDark ? 1 : 0,
        borderColor: theme.border,
    },
    usageTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.textSecondary,
        marginBottom: 12,
    },
    usageBar: {
        height: 8,
        backgroundColor: theme.surface,
        borderRadius: 4,
        overflow: 'hidden',
    },
    usageFill: {
        height: 8,
        backgroundColor: theme.primary,
        borderRadius: 4,
    },
    usageText: {
        fontSize: 13,
        color: theme.textTertiary,
        marginTop: 8,
    },
    upgradeHeader: {
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 32,
        paddingBottom: 24,
    },
    upgradeTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: theme.text,
        marginTop: 12,
    },
    upgradeSubtitle: {
        fontSize: 14,
        color: theme.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
    },
    plansContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 12,
    },
    planCard: {
        flex: 1,
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 20,
        borderWidth: 2,
        borderColor: theme.border,
    },
    planCardSelected: {
        borderColor: theme.primary,
        backgroundColor: theme.primaryLight,
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    planName: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.text,
    },
    planNameSelected: {
        color: theme.primary,
    },
    planPrice: {
        fontSize: 28,
        fontWeight: '700',
        color: theme.text,
    },
    planPriceSelected: {
        color: theme.primary,
    },
    planPeriod: {
        fontSize: 13,
        color: theme.textSecondary,
        marginTop: 2,
    },
    planPeriodSelected: {
        color: theme.primary,
    },
    radioOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: theme.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioOuterSelected: {
        borderColor: theme.primary,
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: theme.primary,
    },
    saveBadge: {
        position: 'absolute',
        top: -10,
        right: 12,
        backgroundColor: theme.accent,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    saveBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    featuresSection: {
        paddingHorizontal: 20,
        marginTop: 28,
    },
    featuresTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.text,
        marginBottom: 16,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 14,
    },
    featureText: {
        fontSize: 15,
        color: theme.text,
    },
    subscribeContainer: {
        paddingHorizontal: 20,
        marginTop: 28,
    },
    subscribeButton: {
        backgroundColor: theme.primary,
        borderRadius: 16,
        paddingVertical: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    subscribeText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    disclaimer: {
        fontSize: 11,
        color: theme.textTertiary,
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 16,
    },
    demoSection: {
        paddingHorizontal: 20,
        marginTop: 32,
    },
    demoBorder: {
        borderWidth: 1,
        borderColor: theme.textTertiary + '40',
        borderRadius: 16,
        borderStyle: 'dashed',
        padding: 16,
    },
    demoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    demoTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: theme.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    demoDesc: {
        fontSize: 12,
        color: theme.textTertiary,
        lineHeight: 16,
        marginBottom: 16,
    },
    demoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: theme.surface,
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: theme.border,
    },
    demoButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: theme.text,
    },
});
