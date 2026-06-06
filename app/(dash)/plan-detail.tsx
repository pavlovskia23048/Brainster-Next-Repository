import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native';
import { showAlert } from '@/utils/dialogs';
import React, { useState, useEffect, useMemo } from 'react';
import { Text } from '@/components/common/Text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '@/utils/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';
import Toast from 'react-native-toast-message';
import { getPlan, archivePlan, deletePlan, formatGoal, formatExperience, WorkoutPlan } from '@/services/aiPlanService';

const DAY_ICONS: Record<string, string> = {
    'Monday': 'numeric-1-circle',
    'Tuesday': 'numeric-2-circle',
    'Wednesday': 'numeric-3-circle',
    'Thursday': 'numeric-4-circle',
    'Friday': 'numeric-5-circle',
    'Saturday': 'numeric-6-circle',
    'Sunday': 'numeric-7-circle',
};

export default function PlanDetail() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { theme, isDark } = useTheme();
    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

    const [plan, setPlan] = useState<WorkoutPlan | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedDay, setExpandedDay] = useState<number>(0);

    useEffect(() => {
        loadPlan();
    }, [id]);

    const loadPlan = async () => {
        if (!id) return;
        try {
            const data = await getPlan(id as string);
            setPlan(data);
        } catch (error) {
            console.error('Error loading plan:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load plan', position: 'top' });
        } finally {
            setLoading(false);
        }
    };

    const handleArchive = () => {
        if (!plan) return;
        showAlert(
            'Archive Plan',
            'This plan will be moved to your archived plans.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Archive',
                    onPress: async () => {
                        try {
                            await archivePlan(plan.id);
                            Toast.show({ type: 'success', text1: 'Plan archived', position: 'top' });
                            safeBack(router);
                        } catch {
                            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to archive plan', position: 'top' });
                        }
                    },
                },
            ]
        );
    };

    const handleDelete = () => {
        if (!plan) return;
        showAlert(
            'Delete Plan',
            'This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deletePlan(plan.id);
                            Toast.show({ type: 'success', text1: 'Plan deleted', position: 'top' });
                            safeBack(router);
                        } catch {
                            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to delete plan', position: 'top' });
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    if (!plan) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />
                <Text style={styles.errorText}>Plan not found</Text>
                <TouchableOpacity onPress={() => safeBack(router)}>
                    <Text style={styles.linkText}>Go back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const dateStr = plan.createdAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router)}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Plan Detail</Text>
                <TouchableOpacity style={styles.menuButton} onPress={handleDelete}>
                    <MaterialCommunityIcons name="delete-outline" size={22} color={theme.error} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Plan Info Card */}
                <View style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                        <View style={styles.goalBadge}>
                            <MaterialCommunityIcons name="target" size={16} color={theme.primary} />
                            <Text style={styles.goalText}>{formatGoal(plan.questionnaire.fitnessGoal)}</Text>
                        </View>
                        {plan.status === 'active' && (
                            <TouchableOpacity style={styles.archiveButton} onPress={handleArchive}>
                                <MaterialCommunityIcons name="archive-outline" size={18} color={theme.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.infoStats}>
                        <View style={styles.infoStat}>
                            <Text style={styles.infoStatValue}>{plan.weeklyPlan.length}</Text>
                            <Text style={styles.infoStatLabel}>Days/Week</Text>
                        </View>
                        <View style={styles.infoStatDivider} />
                        <View style={styles.infoStat}>
                            <Text style={styles.infoStatValue}>{plan.questionnaire.sessionDuration}</Text>
                            <Text style={styles.infoStatLabel}>Min/Session</Text>
                        </View>
                        <View style={styles.infoStatDivider} />
                        <View style={styles.infoStat}>
                            <Text style={styles.infoStatValue}>{formatExperience(plan.questionnaire.experienceLevel)}</Text>
                            <Text style={styles.infoStatLabel}>Level</Text>
                        </View>
                    </View>

                    <Text style={styles.dateText}>Created on {dateStr}</Text>

                    {plan.questionnaire.availableEquipment.length > 0 && (
                        <View style={styles.equipmentRow}>
                            <MaterialCommunityIcons name="dumbbell" size={14} color={theme.textSecondary} />
                            <Text style={styles.equipmentText}>
                                {plan.questionnaire.availableEquipment.map(e => e.replace(/_/g, ' ')).join(', ')}
                            </Text>
                        </View>
                    )}

                    {plan.questionnaire.injuries ? (
                        <View style={styles.injuryRow}>
                            <MaterialCommunityIcons name="alert-circle-outline" size={14} color={theme.warning || '#F59E0B'} />
                            <Text style={styles.injuryText}>{plan.questionnaire.injuries}</Text>
                        </View>
                    ) : null}
                </View>

                {/* Weekly Plan */}
                <View style={styles.weekSection}>
                    <Text style={styles.weekTitle}>Weekly Plan</Text>

                    {plan.weeklyPlan.map((day, index) => (
                        <View key={index} style={styles.dayCard}>
                            <TouchableOpacity
                                style={styles.dayHeader}
                                onPress={() => setExpandedDay(expandedDay === index ? -1 : index)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.dayHeaderLeft}>
                                    <View style={styles.dayBadge}>
                                        <MaterialCommunityIcons
                                            name={(DAY_ICONS[day.day] || 'circle') as any}
                                            size={24}
                                            color={theme.primary}
                                        />
                                    </View>
                                    <View>
                                        <Text style={styles.dayName}>{day.day}</Text>
                                        <Text style={styles.dayFocus}>{day.focus}</Text>
                                    </View>
                                </View>
                                <View style={styles.dayHeaderRight}>
                                    <Text style={styles.exerciseCount}>{day.exercises.length} exercises</Text>
                                    <MaterialCommunityIcons
                                        name={expandedDay === index ? 'chevron-up' : 'chevron-down'}
                                        size={20}
                                        color={theme.textTertiary}
                                    />
                                </View>
                            </TouchableOpacity>

                            {expandedDay === index && (
                                <View style={styles.exerciseList}>
                                    {day.exercises.map((exercise, exIndex) => (
                                        <View key={exIndex} style={styles.exerciseItem}>
                                            <View style={styles.exerciseNumber}>
                                                <Text style={styles.exerciseNumberText}>{exIndex + 1}</Text>
                                            </View>
                                            <View style={styles.exerciseInfo}>
                                                <Text style={styles.exerciseName}>{exercise.name}</Text>
                                                <View style={styles.exerciseDetails}>
                                                    <Text style={styles.exerciseDetail}>
                                                        {exercise.sets} sets x {exercise.reps}
                                                    </Text>
                                                    {(() => {
                                                        const w = (exercise.weight || '').trim();
                                                        if (!w || w === 'N/A') return null;
                                                        const wl = w.toLowerCase();
                                                        // Skip vague legacy values that snuck past pre-aiTools generations
                                                        if (wl === 'moderate' || wl === 'light' || wl === 'heavy') return null;
                                                        const display = /^\d+(\.\d+)?$/.test(w) ? `${w}kg` : w;
                                                        return <Text style={styles.exerciseDetail}>@ {display}</Text>;
                                                    })()}
                                                </View>
                                                {exercise.notes ? (
                                                    <Text style={styles.exerciseNotes}>{exercise.notes}</Text>
                                                ) : null}
                                            </View>
                                        </View>
                                    ))}
                                    <TouchableOpacity
                                        style={styles.startWorkoutButton}
                                        onPress={() => {
                                            const planExercises = day.exercises.map((ex, i) => {
                                                // Strip "kg" suffix when forwarding to the manual logger,
                                                // because the logger stores a numeric weight + a separate unit.
                                                const raw = (ex.weight || '').trim();
                                                const rawLower = raw.toLowerCase();
                                                const numericMatch = raw.match(/(\d+(?:\.\d+)?)/);
                                                const isBodyweight = rawLower === 'bodyweight' || rawLower === '';
                                                const weight = isBodyweight
                                                    ? ''
                                                    : numericMatch
                                                        ? numericMatch[1]
                                                        : '';
                                                return {
                                                    id: `plan-${i}`,
                                                    name: ex.name,
                                                    sets: ex.sets,
                                                    reps: typeof ex.reps === 'string' ? parseInt(ex.reps) || 10 : ex.reps,
                                                    weight,
                                                    unit: 'kg' as const,
                                                    resistance: '',
                                                    notes: ex.notes || '',
                                                };
                                            });
                                            router.push({
                                                pathname: '/(dash)/create-workout',
                                                params: {
                                                    fromPlan: JSON.stringify({
                                                        workoutName: `${day.day} - ${day.focus}`,
                                                        exercises: planExercises,
                                                    }),
                                                },
                                            });
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <MaterialCommunityIcons name="play-circle" size={20} color="#FFFFFF" />
                                        <Text style={styles.startWorkoutButtonText}>Start This Workout</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    ))}
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
    errorText: {
        fontSize: 16,
        color: theme.textSecondary,
        marginBottom: 12,
    },
    linkText: {
        fontSize: 16,
        color: theme.primary,
        fontWeight: '600',
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
    menuButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    infoCard: {
        backgroundColor: theme.card,
        margin: 20,
        borderRadius: 16,
        padding: 20,
        borderWidth: isDark ? 1 : 0,
        borderColor: theme.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    infoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    goalBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: theme.primaryLight,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    goalText: {
        fontSize: 14,
        fontWeight: '700',
        color: theme.primary,
    },
    archiveButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: theme.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoStats: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    infoStat: {
        alignItems: 'center',
    },
    infoStatValue: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.text,
    },
    infoStatLabel: {
        fontSize: 11,
        color: theme.textSecondary,
        marginTop: 2,
    },
    infoStatDivider: {
        width: 1,
        height: 30,
        backgroundColor: theme.border,
    },
    dateText: {
        fontSize: 12,
        color: theme.textTertiary,
    },
    equipmentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 10,
    },
    equipmentText: {
        fontSize: 13,
        color: theme.textSecondary,
        flex: 1,
    },
    injuryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    injuryText: {
        fontSize: 13,
        color: theme.textSecondary,
        flex: 1,
    },
    weekSection: {
        paddingHorizontal: 20,
    },
    weekTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.text,
        marginBottom: 16,
    },
    dayCard: {
        backgroundColor: theme.card,
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
        borderWidth: isDark ? 1 : 0,
        borderColor: theme.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDark ? 0.2 : 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    dayHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    dayHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    dayBadge: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: theme.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayName: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.text,
    },
    dayFocus: {
        fontSize: 13,
        color: theme.textSecondary,
        marginTop: 2,
    },
    dayHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    exerciseCount: {
        fontSize: 12,
        color: theme.textTertiary,
    },
    exerciseList: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderTopWidth: 1,
        borderTopColor: theme.border,
    },
    exerciseItem: {
        flexDirection: 'row',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        gap: 12,
    },
    exerciseNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: theme.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    exerciseNumberText: {
        fontSize: 12,
        fontWeight: '700',
        color: theme.textSecondary,
    },
    exerciseInfo: {
        flex: 1,
    },
    exerciseName: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.text,
    },
    exerciseDetails: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
    },
    exerciseDetail: {
        fontSize: 13,
        color: theme.primary,
        fontWeight: '500',
    },
    exerciseNotes: {
        fontSize: 12,
        color: theme.textSecondary,
        marginTop: 4,
        fontStyle: 'italic',
    },
    startWorkoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: theme.primary,
        borderRadius: 12,
        paddingVertical: 14,
        marginTop: 16,
    },
    startWorkoutButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
