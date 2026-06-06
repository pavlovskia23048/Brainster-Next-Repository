import { StyleSheet, View, ScrollView, TouchableOpacity, Dimensions, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Text } from '@/components/common/Text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { auth, db } from '@/config/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { LineChart } from 'react-native-gifted-charts';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const { width } = Dimensions.get('window');

type TimePeriod = '7D' | '30D' | '90D' | 'All';
type ChartType = 'weight' | 'volume';

interface WeightMeasurement {
    id: string;
    date: Date;
    weight: number;
    unit: 'kg' | 'lbs';
}

interface WeightStats {
    current: number | null;
    currentDate: Date | null;
    starting: number | null;
    startingDate: Date | null;
    change: number;
    changePercentage: number;
}

interface ExerciseHistoryEntry {
    date: Date;
    weight: number;
    sets: number;
    reps: number;
    volume: number;
    unit: string;
}

interface ExerciseStats {
    name: string;
    frequency: number;
    maxWeight: number;
    maxWeightDate: Date | null;
    maxWeightUnit: string;
    totalVolume: number;
    history: ExerciseHistoryEntry[];
}

export default function Progress() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('30D');
    const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
    const [chartType, setChartType] = useState<ChartType>('weight');

    // Data state
    const [measurements, setMeasurements] = useState<WeightMeasurement[]>([]);
    const [workoutLogs, setWorkoutLogs] = useState<any[]>([]);

    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

    // Refresh data when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            const currentUser = auth.currentUser;
            if (currentUser) {
                loadData(currentUser.uid);
            }
        }, [])
    );

    // Pull-to-refresh handler
    const onRefresh = useCallback(async () => {
        const currentUser = auth.currentUser;
        if (currentUser) {
            setRefreshing(true);
            await loadData(currentUser.uid);
            setRefreshing(false);
        }
    }, []);

    const loadData = async (userId: string) => {
        try {
            setLoading(true);

            // Load measurements
            const measurementsRef = collection(db, 'measurements');
            const measurementsQuery = query(
                measurementsRef,
                where('userId', '==', userId),
                orderBy('date', 'desc'),
                limit(365)
            );
            const measurementsSnapshot = await getDocs(measurementsQuery);
            const measurementsData: WeightMeasurement[] = measurementsSnapshot.docs.map(doc => ({
                id: doc.id,
                date: doc.data().date.toDate(),
                weight: doc.data().weight,
                unit: doc.data().unit || 'kg',
            }));
            setMeasurements(measurementsData);

            // Load workout logs
            const workoutLogsRef = collection(db, 'workoutLogs');
            const workoutLogsQuery = query(
                workoutLogsRef,
                where('userId', '==', userId),
                orderBy('date', 'desc'),
                limit(100)
            );
            const workoutLogsSnapshot = await getDocs(workoutLogsQuery);
            const workoutLogsData = workoutLogsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date.toDate(),
            }));
            setWorkoutLogs(workoutLogsData);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Process weight data based on selected period
    const weightDataPoints = useMemo(() => {
        if (measurements.length === 0) return [];

        const now = new Date();
        let filteredData = [...measurements];

        // Filter by period
        if (selectedPeriod !== 'All') {
            const daysMap = { '7D': 7, '30D': 30, '90D': 90 };
            const days = daysMap[selectedPeriod];
            const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
            filteredData = filteredData.filter(m => m.date >= cutoffDate);
        }

        // Sort by date ascending for chart
        filteredData.sort((a, b) => a.date.getTime() - b.date.getTime());

        // Sample data if too many points (> 90)
        if (filteredData.length > 90) {
            const step = Math.ceil(filteredData.length / 90);
            filteredData = filteredData.filter((_, index) => index % step === 0);
        }

        // Convert to chart format
        return filteredData.map((m, index) => ({
            value: m.weight,
            label: index % Math.ceil(filteredData.length / 5) === 0
                ? `${m.date.getMonth() + 1}/${m.date.getDate()}`
                : '',
            date: m.date,
        }));
    }, [measurements, selectedPeriod]);

    // Calculate weight stats
    const weightStats = useMemo((): WeightStats => {
        if (measurements.length === 0) {
            return {
                current: null,
                currentDate: null,
                starting: null,
                startingDate: null,
                change: 0,
                changePercentage: 0,
            };
        }

        const sorted = [...measurements].sort((a, b) => b.date.getTime() - a.date.getTime());
        const current = sorted[0];
        const starting = sorted[sorted.length - 1];

        const change = current.weight - starting.weight;
        const changePercentage = starting.weight !== 0
            ? (change / starting.weight) * 100
            : 0;

        return {
            current: current.weight,
            currentDate: current.date,
            starting: starting.weight,
            startingDate: starting.date,
            change,
            changePercentage,
        };
    }, [measurements]);

    // Aggregate exercise data
    const exerciseStats = useMemo((): ExerciseStats[] => {
        const exerciseMap = new Map<string, ExerciseStats>();

        workoutLogs.forEach(workout => {
            if (!workout.exercises || !Array.isArray(workout.exercises)) return;

            workout.exercises.forEach((exercise: any) => {
                // Normalize exercise name (lowercase, trim)
                const normalizedName = exercise.name?.trim().toLowerCase();
                if (!normalizedName) return;

                const weight = parseFloat(exercise.weight) || 0;
                const sets = exercise.sets || 0;
                const reps = exercise.reps || 0;
                const volume = weight * sets * reps;
                const unit = exercise.unit || 'kg';

                if (!exerciseMap.has(normalizedName)) {
                    exerciseMap.set(normalizedName, {
                        name: exercise.name.trim(), // Keep original casing for display
                        frequency: 0,
                        maxWeight: 0,
                        maxWeightDate: null,
                        maxWeightUnit: unit,
                        totalVolume: 0,
                        history: [],
                    });
                }

                const stats = exerciseMap.get(normalizedName)!;
                stats.frequency += 1;
                stats.totalVolume += volume;

                // Track max weight (skip bodyweight exercises)
                if (unit !== 'bodyweight' && weight > stats.maxWeight) {
                    stats.maxWeight = weight;
                    stats.maxWeightDate = workout.date;
                    stats.maxWeightUnit = unit;
                }

                // Add to history
                stats.history.push({
                    date: workout.date,
                    weight,
                    sets,
                    reps,
                    volume,
                    unit,
                });
            });
        });

        // Sort history by date ascending
        exerciseMap.forEach(stats => {
            stats.history.sort((a, b) => a.date.getTime() - b.date.getTime());
        });

        // Convert to array and sort by frequency
        return Array.from(exerciseMap.values()).sort((a, b) => b.frequency - a.frequency);
    }, [workoutLogs]);

    // Get selected exercise stats
    const selectedExerciseStats = useMemo(() => {
        if (!selectedExercise) return null;
        return exerciseStats.find(
            e => e.name.toLowerCase() === selectedExercise.toLowerCase()
        );
    }, [selectedExercise, exerciseStats]);

    // Get chart data for selected exercise
    const exerciseChartData = useMemo(() => {
        if (!selectedExerciseStats) return [];

        const history = selectedExerciseStats.history;
        let data = chartType === 'weight'
            ? history.filter(h => h.unit !== 'bodyweight').map(h => h.weight)
            : history.map(h => h.volume);

        return history.map((h, index) => ({
            value: chartType === 'weight' ? h.weight : h.volume,
            label: index % Math.ceil(history.length / 5) === 0
                ? `${h.date.getMonth() + 1}/${h.date.getDate()}`
                : '',
        }));
    }, [selectedExerciseStats, chartType]);

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={styles.loadingText}>Loading progress...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Progress</Text>
                    <Text style={styles.headerSubtitle}>Track your fitness journey</Text>
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
                {/* Weight Progress Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Weight Progress</Text>

                    {measurements.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <View style={styles.emptyIconCircle}>
                                <MaterialCommunityIcons name="scale-bathroom" size={32} color={theme.textTertiary} />
                            </View>
                            <Text style={styles.emptyText}>No weight data yet</Text>
                            <Text style={styles.emptySubtext}>Log your weight when creating workouts to track progress</Text>
                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => router.push('/(dash)/create-workout')}
                            >
                                <Text style={styles.secondaryButtonText}>Log First Workout</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            {/* Period Selector */}
                            <View style={styles.periodSelector}>
                                {(['7D', '30D', '90D', 'All'] as TimePeriod[]).map(period => (
                                    <TouchableOpacity
                                        key={period}
                                        style={[
                                            styles.periodOption,
                                            selectedPeriod === period && styles.periodOptionActive
                                        ]}
                                        onPress={() => setSelectedPeriod(period)}
                                    >
                                        <Text style={[
                                            styles.periodText,
                                            selectedPeriod === period && styles.periodTextActive
                                        ]}>
                                            {period}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Stats Grid */}
                            <View style={styles.statsGrid}>
                                {/* Current Weight */}
                                <View style={styles.statCard}>
                                    <Text style={styles.statLabel}>Current Weight</Text>
                                    <View style={styles.statValueRow}>
                                        <Text style={styles.statValue}>
                                            {weightStats.current?.toFixed(1)}
                                        </Text>
                                        <Text style={styles.statUnit}>
                                            {measurements[0]?.unit || 'kg'}
                                        </Text>
                                    </View>
                                    {weightStats.change !== 0 && (
                                        <View style={styles.statTrend}>
                                            <MaterialCommunityIcons
                                                name={weightStats.change > 0 ? 'trending-up' : 'trending-down'}
                                                size={14}
                                                color={weightStats.change > 0 ? theme.error : theme.success}
                                            />
                                            <Text style={[
                                                styles.statTrendText,
                                                { color: weightStats.change > 0 ? theme.error : theme.success }
                                            ]}>
                                                {Math.abs(weightStats.change).toFixed(1)} {measurements[0]?.unit || 'kg'}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {/* Starting Weight */}
                                <View style={styles.statCard}>
                                    <Text style={styles.statLabel}>Starting Weight</Text>
                                    <View style={styles.statValueRow}>
                                        <Text style={styles.statValue}>
                                            {weightStats.starting?.toFixed(1)}
                                        </Text>
                                        <Text style={styles.statUnit}>
                                            {measurements[measurements.length - 1]?.unit || 'kg'}
                                        </Text>
                                    </View>
                                    {weightStats.startingDate && (
                                        <Text style={styles.statDate}>
                                            {formatDate(weightStats.startingDate)}
                                        </Text>
                                    )}
                                </View>

                                {/* Total Change */}
                                <View style={styles.statCard}>
                                    <Text style={styles.statLabel}>Total Change</Text>
                                    <View style={styles.statValueRow}>
                                        <Text style={[
                                            styles.statValue,
                                            { color: weightStats.change > 0 ? theme.error : weightStats.change < 0 ? theme.success : theme.text }
                                        ]}>
                                            {weightStats.change > 0 ? '+' : ''}{weightStats.change.toFixed(1)}
                                        </Text>
                                        <Text style={styles.statUnit}>
                                            {measurements[0]?.unit || 'kg'}
                                        </Text>
                                    </View>
                                    <Text style={styles.statDate}>
                                        {weightStats.changePercentage > 0 ? '+' : ''}{weightStats.changePercentage.toFixed(1)}%
                                    </Text>
                                </View>

                                {/* Measurements Count */}
                                <View style={styles.statCard}>
                                    <Text style={styles.statLabel}>Measurements</Text>
                                    <View style={styles.statValueRow}>
                                        <Text style={styles.statValue}>{measurements.length}</Text>
                                    </View>
                                    <View style={styles.statTrend}>
                                        <MaterialCommunityIcons name="calendar-check" size={14} color={theme.primary} />
                                        <Text style={styles.statTrendText}>Total logged</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Weight Chart */}
                            {weightDataPoints.length >= 2 && (
                                <View style={styles.chartCard}>
                                    <Text style={styles.chartTitle}>Weight Trend</Text>
                                    <LineChart
                                        data={weightDataPoints}
                                        width={width - 80}
                                        height={220}
                                        spacing={weightDataPoints.length > 10 ? (width - 100) / weightDataPoints.length : 40}
                                        initialSpacing={10}
                                        color={theme.chartPrimary}
                                        thickness={3}
                                        startFillColor={isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(27, 49, 108, 0.3)'}
                                        endFillColor={isDark ? 'rgba(59, 130, 246, 0.05)' : 'rgba(27, 49, 108, 0.05)'}
                                        startOpacity={0.9}
                                        endOpacity={0.2}
                                        areaChart
                                        curved
                                        yAxisColor={theme.chartGrid}
                                        xAxisColor={theme.chartGrid}
                                        yAxisTextStyle={{ color: theme.textTertiary, fontSize: 10 }}
                                        xAxisLabelTextStyle={{ color: theme.textTertiary, fontSize: 10, marginTop: 5 }}
                                        hideDataPoints={weightDataPoints.length > 20}
                                        dataPointsColor={theme.chartPrimary}
                                        dataPointsRadius={4}
                                        textColor={theme.textSecondary}
                                        textFontSize={12}
                                        noOfSections={4}
                                        yAxisLabelWidth={40}
                                        showVerticalLines
                                        verticalLinesColor={isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(229, 229, 229, 0.5)'}
                                    />
                                </View>
                            )}
                        </>
                    )}
                </View>

                {/* Exercise Progress Section */}
                <View style={[styles.section, { marginBottom: 100 }]}>
                    <Text style={styles.sectionTitle}>Exercise Progress</Text>

                    {exerciseStats.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <View style={styles.emptyIconCircle}>
                                <MaterialCommunityIcons name="dumbbell" size={32} color={theme.textTertiary} />
                            </View>
                            <Text style={styles.emptyText}>No exercises logged yet</Text>
                            <Text style={styles.emptySubtext}>Start logging workouts to track exercise progress</Text>
                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => router.push('/(dash)/create-workout')}
                            >
                                <Text style={styles.secondaryButtonText}>Start First Workout</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            {/* Exercise Selector */}
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.exerciseSelector}
                                contentContainerStyle={styles.exerciseSelectorContent}
                            >
                                {exerciseStats.map((exercise) => (
                                    <TouchableOpacity
                                        key={exercise.name}
                                        style={[
                                            styles.exerciseCard,
                                            selectedExercise === exercise.name && styles.exerciseCardActive
                                        ]}
                                        onPress={() => setSelectedExercise(exercise.name)}
                                    >
                                        <Text style={[
                                            styles.exerciseName,
                                            selectedExercise === exercise.name && styles.exerciseNameActive
                                        ]}>
                                            {exercise.name}
                                        </Text>
                                        <View style={styles.exerciseFrequency}>
                                            <MaterialCommunityIcons
                                                name="repeat"
                                                size={12}
                                                color={selectedExercise === exercise.name ? theme.primary : theme.textTertiary}
                                            />
                                            <Text style={[
                                                styles.exerciseFrequencyText,
                                                selectedExercise === exercise.name && styles.exerciseFrequencyTextActive
                                            ]}>
                                                {exercise.frequency}x
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {selectedExerciseStats ? (
                                <>
                                    {/* Exercise Metrics */}
                                    <View style={styles.metricsGrid}>
                                        {/* Personal Record */}
                                        <View style={styles.metricCard}>
                                            <View style={styles.metricIconContainer}>
                                                <MaterialCommunityIcons name="trophy" size={20} color={theme.warning} />
                                            </View>
                                            <Text style={styles.metricLabel}>Personal Record</Text>
                                            <Text style={styles.metricValue}>
                                                {selectedExerciseStats.maxWeight > 0
                                                    ? `${selectedExerciseStats.maxWeight} ${selectedExerciseStats.maxWeightUnit}`
                                                    : 'Bodyweight'}
                                            </Text>
                                            {selectedExerciseStats.maxWeightDate && (
                                                <Text style={styles.metricDate}>
                                                    {formatDate(selectedExerciseStats.maxWeightDate)}
                                                </Text>
                                            )}
                                        </View>

                                        {/* Total Volume */}
                                        <View style={styles.metricCard}>
                                            <View style={styles.metricIconContainer}>
                                                <MaterialCommunityIcons name="weight-lifter" size={20} color={theme.primary} />
                                            </View>
                                            <Text style={styles.metricLabel}>Total Volume</Text>
                                            <Text style={styles.metricValue}>
                                                {selectedExerciseStats.totalVolume.toLocaleString()}
                                            </Text>
                                            <Text style={styles.metricDate}>All-time</Text>
                                        </View>

                                        {/* Frequency */}
                                        <View style={styles.metricCard}>
                                            <View style={styles.metricIconContainer}>
                                                <MaterialCommunityIcons name="calendar-check" size={20} color={theme.success} />
                                            </View>
                                            <Text style={styles.metricLabel}>Frequency</Text>
                                            <Text style={styles.metricValue}>{selectedExerciseStats.frequency}</Text>
                                            <Text style={styles.metricDate}>Times performed</Text>
                                        </View>
                                    </View>

                                    {/* Chart Type Toggle */}
                                    {selectedExerciseStats.history.length >= 2 && (
                                        <>
                                            <View style={styles.chartTypeToggle}>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.chartTypeOption,
                                                        chartType === 'weight' && styles.chartTypeOptionActive
                                                    ]}
                                                    onPress={() => setChartType('weight')}
                                                >
                                                    <Text style={[
                                                        styles.chartTypeText,
                                                        chartType === 'weight' && styles.chartTypeTextActive
                                                    ]}>
                                                        Max Weight
                                                    </Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.chartTypeOption,
                                                        chartType === 'volume' && styles.chartTypeOptionActive
                                                    ]}
                                                    onPress={() => setChartType('volume')}
                                                >
                                                    <Text style={[
                                                        styles.chartTypeText,
                                                        chartType === 'volume' && styles.chartTypeTextActive
                                                    ]}>
                                                        Volume
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>

                                            {/* Exercise Chart */}
                                            <View style={styles.chartCard}>
                                                <Text style={styles.chartTitle}>
                                                    {chartType === 'weight' ? 'Weight Progression' : 'Volume Progression'}
                                                </Text>
                                                <LineChart
                                                    data={exerciseChartData}
                                                    width={width - 80}
                                                    height={220}
                                                    spacing={exerciseChartData.length > 10 ? (width - 100) / exerciseChartData.length : 40}
                                                    initialSpacing={10}
                                                    color={chartType === 'weight' ? theme.chartPrimary : theme.chartSecondary}
                                                    thickness={3}
                                                    startFillColor={chartType === 'weight'
                                                        ? (isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(27, 49, 108, 0.3)')
                                                        : (isDark ? 'rgba(34, 197, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)')}
                                                    endFillColor={chartType === 'weight'
                                                        ? (isDark ? 'rgba(59, 130, 246, 0.05)' : 'rgba(27, 49, 108, 0.05)')
                                                        : (isDark ? 'rgba(34, 197, 94, 0.05)' : 'rgba(16, 185, 129, 0.05)')}
                                                    startOpacity={0.9}
                                                    endOpacity={0.2}
                                                    areaChart
                                                    curved
                                                    yAxisColor={theme.chartGrid}
                                                    xAxisColor={theme.chartGrid}
                                                    yAxisTextStyle={{ color: theme.textTertiary, fontSize: 10 }}
                                                    xAxisLabelTextStyle={{ color: theme.textTertiary, fontSize: 10, marginTop: 5 }}
                                                    hideDataPoints={exerciseChartData.length > 20}
                                                    dataPointsColor={chartType === 'weight' ? theme.chartPrimary : theme.chartSecondary}
                                                    dataPointsRadius={4}
                                                    textColor={theme.textSecondary}
                                                    textFontSize={12}
                                                    noOfSections={4}
                                                    yAxisLabelWidth={40}
                                                    showVerticalLines
                                                    verticalLinesColor={isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(229, 229, 229, 0.5)'}
                                                />
                                            </View>
                                        </>
                                    )}
                                </>
                            ) : (
                                <View style={styles.noSelectionCard}>
                                    <MaterialCommunityIcons name="dumbbell" size={48} color={theme.textTertiary} />
                                    <Text style={styles.noSelectionText}>Select an exercise to view progress</Text>
                                </View>
                            )}
                        </>
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: theme.textSecondary,
        marginTop: 8,
    },
    scrollView: {
        flex: 1,
    },
    header: {
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
    section: {
        paddingHorizontal: 20,
        marginTop: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.text,
        marginBottom: 16,
    },
    emptyCard: {
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 32,
        alignItems: 'center',
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: isDark ? 1 : 0,
        borderColor: theme.border,
    },
    emptyIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: theme.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.textSecondary,
        marginBottom: 6,
    },
    emptySubtext: {
        fontSize: 14,
        color: theme.textTertiary,
        textAlign: 'center',
        marginBottom: 20,
    },
    secondaryButton: {
        backgroundColor: theme.primaryLight,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 10,
    },
    secondaryButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.primary,
    },
    periodSelector: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    periodOption: {
        flex: 1,
        backgroundColor: theme.surface,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.border,
    },
    periodOptionActive: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
    },
    periodText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.textSecondary,
    },
    periodTextActive: {
        color: theme.surface,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
    },
    statCard: {
        flex: 1,
        minWidth: '47%',
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
    statLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: theme.textSecondary,
        marginBottom: 8,
    },
    statValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '800',
        color: theme.text,
    },
    statUnit: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.textTertiary,
    },
    statDate: {
        fontSize: 12,
        color: theme.textTertiary,
        marginTop: 4,
    },
    statTrend: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
    },
    statTrendText: {
        fontSize: 12,
        fontWeight: '500',
    },
    chartCard: {
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 20,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
        alignItems: 'center',
        borderWidth: isDark ? 1 : 0,
        borderColor: theme.border,
    },
    chartTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.text,
        marginBottom: 16,
        alignSelf: 'flex-start',
    },
    exerciseSelector: {
        marginBottom: 16,
    },
    exerciseSelectorContent: {
        gap: 8,
        paddingRight: 20,
    },
    exerciseCard: {
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 12,
        minWidth: 140,
        borderWidth: 2,
        borderColor: theme.border,
    },
    exerciseCardActive: {
        borderColor: theme.primary,
        backgroundColor: theme.primaryLight,
    },
    exerciseName: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.text,
        marginBottom: 6,
    },
    exerciseNameActive: {
        color: theme.primary,
    },
    exerciseFrequency: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    exerciseFrequencyText: {
        fontSize: 12,
        fontWeight: '500',
        color: theme.textTertiary,
    },
    exerciseFrequencyTextActive: {
        color: theme.primary,
    },
    metricsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    metricCard: {
        flex: 1,
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 12,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: isDark ? 1 : 0,
        borderColor: theme.border,
    },
    metricIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: theme.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    metricLabel: {
        fontSize: 11,
        fontWeight: '500',
        color: theme.textSecondary,
        marginBottom: 4,
    },
    metricValue: {
        fontSize: 16,
        fontWeight: '800',
        color: theme.text,
        marginBottom: 2,
    },
    metricDate: {
        fontSize: 10,
        color: theme.textTertiary,
    },
    chartTypeToggle: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    chartTypeOption: {
        flex: 1,
        backgroundColor: theme.surface,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.border,
    },
    chartTypeOptionActive: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
    },
    chartTypeText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.textSecondary,
    },
    chartTypeTextActive: {
        color: theme.surface,
    },
    noSelectionCard: {
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 48,
        alignItems: 'center',
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: isDark ? 1 : 0,
        borderColor: theme.border,
    },
    noSelectionText: {
        fontSize: 14,
        color: theme.textTertiary,
        marginTop: 12,
    },
});
