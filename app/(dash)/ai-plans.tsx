import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Text } from '@/components/common/Text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeBack } from '@/utils/navigation';
import { auth } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';
import { getUserPlans, formatGoal, WorkoutPlan } from '@/services/aiPlanService';

export default function AIPlans() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

    const [plans, setPlans] = useState<WorkoutPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadPlans = async () => {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const userPlans = await getUserPlans(user.uid);
            setPlans(userPlans);
        } catch (error) {
            console.error('Error loading plans:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadPlans();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadPlans();
    }, []);

    const activePlans = plans.filter(p => p.status === 'active');
    const archivedPlans = plans.filter(p => p.status === 'archived');

    if (loading) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router)}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>AI Workout Plans</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => router.push('/(dash)/ai-questionnaire')}
                >
                    <MaterialCommunityIcons name="plus" size={24} color={theme.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
                }
            >
                {plans.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="robot-outline" size={64} color={theme.textTertiary} />
                        <Text style={styles.emptyTitle}>No Plans Yet</Text>
                        <Text style={styles.emptySubtitle}>
                            Generate your first personalized workout plan with AI
                        </Text>
                        <TouchableOpacity
                            style={styles.generateButton}
                            onPress={() => router.push('/(dash)/ai-questionnaire')}
                        >
                            <MaterialCommunityIcons name="robot" size={20} color="#FFFFFF" />
                            <Text style={styles.generateButtonText}>Generate Plan</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {activePlans.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Active Plans</Text>
                                {activePlans.map(plan => (
                                    <PlanCard
                                        key={plan.id}
                                        plan={plan}
                                        theme={theme}
                                        isDark={isDark}
                                        onPress={() => router.push({ pathname: '/(dash)/plan-detail', params: { id: plan.id } })}
                                    />
                                ))}
                            </View>
                        )}

                        {archivedPlans.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Archived</Text>
                                {archivedPlans.map(plan => (
                                    <PlanCard
                                        key={plan.id}
                                        plan={plan}
                                        theme={theme}
                                        isDark={isDark}
                                        onPress={() => router.push({ pathname: '/(dash)/plan-detail', params: { id: plan.id } })}
                                    />
                                ))}
                            </View>
                        )}
                    </>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
}

function PlanCard({ plan, theme, isDark, onPress }: { plan: WorkoutPlan; theme: ThemeColors; isDark: boolean; onPress: () => void }) {
    const cardStyles = useMemo(() => createCardStyles(theme, isDark), [theme, isDark]);
    const daysCount = plan.weeklyPlan.length;
    const dateStr = plan.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.7}>
            <View style={cardStyles.cardHeader}>
                <View style={cardStyles.goalBadge}>
                    <Text style={cardStyles.goalText}>{formatGoal(plan.questionnaire.fitnessGoal)}</Text>
                </View>
                {plan.status === 'archived' && (
                    <View style={cardStyles.archivedBadge}>
                        <Text style={cardStyles.archivedText}>Archived</Text>
                    </View>
                )}
            </View>

            <View style={cardStyles.cardBody}>
                <View style={cardStyles.stat}>
                    <MaterialCommunityIcons name="calendar-week" size={16} color={theme.textSecondary} />
                    <Text style={cardStyles.statText}>{daysCount} days/week</Text>
                </View>
                <View style={cardStyles.stat}>
                    <MaterialCommunityIcons name="clock-outline" size={16} color={theme.textSecondary} />
                    <Text style={cardStyles.statText}>{plan.questionnaire.sessionDuration} min</Text>
                </View>
                <View style={cardStyles.stat}>
                    <MaterialCommunityIcons name="arm-flex" size={16} color={theme.textSecondary} />
                    <Text style={cardStyles.statText}>{plan.questionnaire.experienceLevel}</Text>
                </View>
            </View>

            <View style={cardStyles.cardFooter}>
                <Text style={cardStyles.dateText}>Created {dateStr}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textTertiary} />
            </View>
        </TouchableOpacity>
    );
}

const createCardStyles = (theme: ThemeColors, isDark: boolean) => StyleSheet.create({
    card: {
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: isDark ? 1 : 0,
        borderColor: theme.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    goalBadge: {
        backgroundColor: theme.primaryLight,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    goalText: {
        fontSize: 13,
        fontWeight: '700',
        color: theme.primary,
    },
    archivedBadge: {
        backgroundColor: theme.surface,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    archivedText: {
        fontSize: 12,
        color: theme.textSecondary,
    },
    cardBody: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 12,
    },
    stat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        fontSize: 13,
        color: theme.textSecondary,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: theme.border,
        paddingTop: 12,
    },
    dateText: {
        fontSize: 12,
        color: theme.textTertiary,
    },
});

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
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    section: {
        paddingHorizontal: 20,
        marginTop: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.text,
        marginBottom: 12,
    },
    emptyState: {
        alignItems: 'center',
        paddingTop: 80,
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.text,
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: theme.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
    },
    generateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.primary,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 14,
        marginTop: 24,
        gap: 8,
    },
    generateButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
