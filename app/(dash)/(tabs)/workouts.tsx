import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, RefreshControl } from 'react-native';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Text } from '@/components/common/Text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Calendar, DateData } from 'react-native-calendars';
import { auth, db } from '@/config/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

interface WorkoutLog {
    id: string;
    userId: string;
    workoutName: string;
    date: Date;
    duration: number;
    exercises: any[];
}

export default function Workouts() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
    const [markedDates, setMarkedDates] = useState<any>({});
    const [selectedDate, setSelectedDate] = useState('');
    const [streak, setStreak] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const currentUserId = auth.currentUser?.uid;

    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

    // Refresh workouts when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            if (currentUserId) {
                loadWorkouts();
            }
        }, [currentUserId])
    );

    // Pull-to-refresh handler
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadWorkouts();
        setRefreshing(false);
    }, [currentUserId]);

    const loadWorkouts = async () => {
        if (!currentUserId) return;

        try {
            const workoutsRef = collection(db, 'workoutLogs');
            const q = query(
                workoutsRef,
                where('userId', '==', currentUserId),
                orderBy('date', 'desc')
            );
            const snapshot = await getDocs(q);

            const logs: WorkoutLog[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date.toDate(),
            })) as WorkoutLog[];

            setWorkoutLogs(logs);
            markCalendarDates(logs);
            calculateStreak(logs);
        } catch (error) {
            console.error('Error loading workouts:', error);
        } finally {
            setLoading(false);
        }
    };

    const markCalendarDates = (logs: WorkoutLog[]) => {
        const marked: any = {};
        logs.forEach(log => {
            const dateStr = log.date.toISOString().split('T')[0];
            marked[dateStr] = {
                marked: true,
                dotColor: theme.primary,
                selectedColor: theme.primary,
            };
        });
        setMarkedDates(marked);
    };

    const calculateStreak = (logs: WorkoutLog[]) => {
        if (logs.length === 0) {
            setStreak(0);
            return;
        }

        // Sort by date descending
        const sortedLogs = [...logs].sort((a, b) => b.date.getTime() - a.date.getTime());

        let currentStreak = 0;
        let lastDate = new Date();
        lastDate.setHours(0, 0, 0, 0);

        for (const log of sortedLogs) {
            const logDate = new Date(log.date);
            logDate.setHours(0, 0, 0, 0);

            const diffTime = lastDate.getTime() - logDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 0 || diffDays === 1) {
                currentStreak++;
                lastDate = logDate;
            } else {
                break;
            }
        }

        setStreak(currentStreak);
    };

    const handleDayPress = (day: DateData) => {
        setSelectedDate(day.dateString);
    };

    const getWorkoutsForSelectedDate = () => {
        if (!selectedDate) return [];
        return workoutLogs.filter(log => {
            const dateStr = log.date.toISOString().split('T')[0];
            return dateStr === selectedDate;
        });
    };

    const recentWorkouts = workoutLogs.slice(0, 5);
    const selectedDayWorkouts = getWorkoutsForSelectedDate();

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>My Workouts</Text>
                    <Text style={styles.headerSubtitle}>{workoutLogs.length} total workouts</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: theme.accent }]}
                        onPress={() => router.push('/(dash)/ai-questionnaire')}
                    >
                        <MaterialCommunityIcons name="robot" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => router.push('/(dash)/create-workout')}
                    >
                        <MaterialCommunityIcons name="plus" size={24} color={theme.surface} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[theme.primary]}
                        tintColor={theme.primary}
                    />
                }
            >
                {/* Streak Card */}
                <View style={styles.section}>
                    <View style={styles.streakCard}>
                        <View style={styles.streakIconContainer}>
                            <MaterialCommunityIcons name="fire" size={32} color={theme.accent} />
                        </View>
                        <View style={styles.streakInfo}>
                            <Text style={styles.streakValue}>{streak} Day Streak</Text>
                            <Text style={styles.streakSubtext}>Keep it going!</Text>
                        </View>
                    </View>
                </View>

                {/* Calendar */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Workout Calendar</Text>
                    <View style={styles.calendarCard}>
                        <Calendar
                            key={isDark ? 'calendar-dark' : 'calendar-light'}
                            markedDates={{
                                ...markedDates,
                                ...(selectedDate && {
                                    [selectedDate]: {
                                        ...markedDates[selectedDate],
                                        selected: true,
                                        selectedColor: theme.primary,
                                    },
                                }),
                            }}
                            onDayPress={handleDayPress}
                            theme={{
                                calendarBackground: theme.surface,
                                textSectionTitleColor: theme.textSecondary,
                                selectedDayBackgroundColor: theme.primary,
                                selectedDayTextColor: '#FFFFFF',
                                todayTextColor: theme.primary,
                                dayTextColor: theme.text,
                                textDisabledColor: theme.textTertiary,
                                monthTextColor: theme.text,
                                arrowColor: theme.primary,
                                dotColor: theme.primary,
                                selectedDotColor: '#FFFFFF',
                                textMonthFontWeight: '700',
                                textDayFontSize: 14,
                                textMonthFontSize: 16,
                            }}
                        />
                    </View>
                </View>

                {/* Selected Day Workouts */}
                {selectedDate && selectedDayWorkouts.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Workouts on {new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                        <View style={styles.workoutsList}>
                            {selectedDayWorkouts.map(workout => (
                                <TouchableOpacity
                                    key={workout.id}
                                    style={styles.workoutCard}
                                    onPress={() => router.push(`/(dash)/workout-detail?id=${workout.id}`)}
                                >
                                    <View style={styles.workoutIconContainer}>
                                        <MaterialCommunityIcons name="dumbbell" size={24} color={theme.primary} />
                                    </View>
                                    <View style={styles.workoutInfo}>
                                        <Text style={styles.workoutName}>{workout.workoutName}</Text>
                                        <View style={styles.workoutMeta}>
                                            <MaterialCommunityIcons name="clock-outline" size={14} color={theme.textTertiary} />
                                            <Text style={styles.workoutMetaText}>{workout.duration} min</Text>
                                            <MaterialCommunityIcons name="weight-lifter" size={14} color={theme.textTertiary} style={{ marginLeft: 12 }} />
                                            <Text style={styles.workoutMetaText}>{workout.exercises.length} exercises</Text>
                                        </View>
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={24} color={theme.textTertiary} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* Recent Workouts */}
                <View style={[styles.section, { marginBottom: 100 }]}>
                    <Text style={styles.sectionTitle}>Recent Workouts</Text>
                    {loading ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>Loading...</Text>
                        </View>
                    ) : recentWorkouts.length === 0 ? (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIconCircle}>
                                <MaterialCommunityIcons name="weight-lifter" size={48} color={theme.textTertiary} />
                            </View>
                            <Text style={styles.emptyTitle}>No workouts yet</Text>
                            <Text style={styles.emptySubtext}>Start your first workout to build your streak</Text>
                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={() => router.push('/(dash)/create-workout')}
                            >
                                <Text style={styles.primaryButtonText}>Create Workout</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.workoutsList}>
                            {recentWorkouts.map(workout => (
                                <TouchableOpacity
                                    key={workout.id}
                                    style={styles.workoutCard}
                                    onPress={() => router.push(`/(dash)/workout-detail?id=${workout.id}`)}
                                >
                                    <View style={styles.workoutIconContainer}>
                                        <MaterialCommunityIcons name="dumbbell" size={24} color={theme.primary} />
                                    </View>
                                    <View style={styles.workoutInfo}>
                                        <Text style={styles.workoutName}>{workout.workoutName}</Text>
                                        <View style={styles.workoutMeta}>
                                            <MaterialCommunityIcons name="calendar" size={14} color={theme.textTertiary} />
                                            <Text style={styles.workoutMetaText}>
                                                {workout.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </Text>
                                            <MaterialCommunityIcons name="clock-outline" size={14} color={theme.textTertiary} style={{ marginLeft: 12 }} />
                                            <Text style={styles.workoutMetaText}>{workout.duration} min</Text>
                                        </View>
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={24} color={theme.textTertiary} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const createStyles = (theme: ThemeColors, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    scrollView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 24,
        backgroundColor: theme.surface,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '700',
        color: theme.text,
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: theme.textSecondary,
    },
    addButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: theme.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    section: {
        paddingHorizontal: 20,
        marginTop: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.text,
        marginBottom: 12,
    },
    streakCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? 'rgba(255, 107, 53, 0.15)' : '#FFF3E0',
        borderRadius: 16,
        padding: 20,
        borderLeftWidth: 4,
        borderLeftColor: theme.accent,
    },
    streakIconContainer: {
        marginRight: 16,
    },
    streakInfo: {
        flex: 1,
    },
    streakValue: {
        fontSize: 20,
        fontWeight: '800',
        color: theme.text,
        marginBottom: 2,
    },
    streakSubtext: {
        fontSize: 14,
        color: theme.textSecondary,
    },
    calendarCard: {
        backgroundColor: theme.surface,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: isDark ? 1 : 0,
        borderColor: theme.border,
    },
    workoutsList: {
        gap: 12,
    },
    workoutCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 16,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: isDark ? 1 : 0,
        borderColor: theme.border,
    },
    workoutIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: theme.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    workoutInfo: {
        flex: 1,
    },
    workoutName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.text,
        marginBottom: 6,
    },
    workoutMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    workoutMetaText: {
        fontSize: 13,
        color: theme.textTertiary,
        marginLeft: 4,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: theme.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.text,
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: theme.textTertiary,
        textAlign: 'center',
        marginBottom: 24,
    },
    emptyText: {
        fontSize: 16,
        color: theme.textTertiary,
    },
    primaryButton: {
        backgroundColor: theme.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    primaryButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
