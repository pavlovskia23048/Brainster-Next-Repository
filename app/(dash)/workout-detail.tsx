import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, Image } from 'react-native';
import { showAlert } from '@/utils/dialogs';
import React, { useState, useEffect, useMemo } from 'react';
import { Text } from '@/components/common/Text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '@/utils/navigation';
import { doc, getDoc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';
import Toast from 'react-native-toast-message';

interface Exercise {
    id: string;
    name: string;
    sets: number;
    reps: number;
    weight: string;
    unit: 'kg' | 'lbs' | 'bodyweight';
    resistance: string;
    notes: string;
}

interface WorkoutLog {
    id: string;
    userId: string;
    workoutName: string;
    date: Date;
    duration: number;
    exercises: Exercise[];
    photos?: string[];
}

export default function WorkoutDetail() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const { id } = useLocalSearchParams();
    const [workout, setWorkout] = useState<WorkoutLog | null>(null);
    const [loading, setLoading] = useState(true);

    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

    useEffect(() => {
        if (id) {
            loadWorkout();
        }
    }, [id]);

    const loadWorkout = async () => {
        try {
            const workoutDoc = await getDoc(doc(db, 'workoutLogs', id as string));
            if (workoutDoc.exists()) {
                const data = workoutDoc.data();
                setWorkout({
                    id: workoutDoc.id,
                    ...data,
                    date: data.date.toDate(),
                } as WorkoutLog);
            }
        } catch (error) {
            console.error('Error loading workout:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = () => {
        router.push(`/(dash)/create-workout?id=${id}`);
    };

    const handleDelete = () => {
        showAlert(
            'Delete Workout',
            'Are you sure you want to delete this workout? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const currentUser = auth.currentUser;
                            if (!currentUser) return;

                            // Delete the workout
                            await deleteDoc(doc(db, 'workoutLogs', id as string));

                            // Update user stats
                            const userRef = doc(db, 'users', currentUser.uid);
                            await updateDoc(userRef, {
                                'stats.totalWorkouts': increment(-1),
                                'stats.points': increment(-10),
                            });

                            Toast.show({
                                type: 'success',
                                text1: 'Workout Deleted',
                                text2: 'Your workout has been removed',
                                position: 'top',
                            });

                            // Navigate back to workouts page
                            router.replace('/(dash)/(tabs)/workouts');
                        } catch (error) {
                            console.error('Error deleting workout:', error);
                            Toast.show({
                                type: 'error',
                                text1: 'Error',
                                text2: 'Failed to delete workout',
                                position: 'top',
                            });
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router)}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Workout Details</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </View>
        );
    }

    if (!workout) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router)}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Workout Details</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={64} color={theme.textTertiary} />
                    <Text style={styles.emptyText}>Workout not found</Text>
                </View>
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
                <Text style={styles.headerTitle}>Workout Details</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.actionButton} onPress={handleEdit}>
                        <MaterialCommunityIcons name="pencil" size={24} color={theme.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={handleDelete}>
                        <MaterialCommunityIcons name="delete-outline" size={24} color="#FF6B6B" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Workout Info Card */}
                <View style={styles.section}>
                    <View style={styles.infoCard}>
                        <View style={styles.infoHeader}>
                            <View style={styles.iconContainer}>
                                <MaterialCommunityIcons name="dumbbell" size={28} color={theme.primary} />
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.workoutName}>{workout.workoutName}</Text>
                                <View style={styles.metaRow}>
                                    <MaterialCommunityIcons name="calendar" size={16} color={theme.textSecondary} />
                                    <Text style={styles.metaText}>
                                        {workout.date.toLocaleDateString('en-US', {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </Text>
                                </View>
                                <View style={styles.metaRow}>
                                    <MaterialCommunityIcons name="clock-outline" size={16} color={theme.textSecondary} />
                                    <Text style={styles.metaText}>{workout.duration} minutes</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Workout Photos */}
                {workout.photos && workout.photos.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Photos ({workout.photos.length})</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
                            {workout.photos.map((photo, index) => (
                                <TouchableOpacity key={index} style={styles.photoContainer}>
                                    <Image source={{ uri: photo }} style={styles.workoutPhoto} />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Exercises */}
                <View style={[styles.section, { marginBottom: 100 }]}>
                    <Text style={styles.sectionTitle}>Exercises ({workout.exercises.length})</Text>
                    <View style={styles.exercisesList}>
                        {workout.exercises.map((exercise, index) => (
                            <View key={`exercise-${index}`} style={styles.exerciseCard}>
                                <View style={styles.exerciseHeader}>
                                    <View style={styles.exerciseNumber}>
                                        <Text style={styles.exerciseNumberText}>{index + 1}</Text>
                                    </View>
                                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                                </View>

                                <View style={styles.exerciseDetails}>
                                    <View style={styles.detailRow}>
                                        <View style={styles.detailItem}>
                                            <MaterialCommunityIcons name="repeat" size={18} color={theme.textSecondary} />
                                            <Text style={styles.detailLabel}>Sets</Text>
                                            <Text style={styles.detailValue}>{exercise.sets}</Text>
                                        </View>
                                        <View style={styles.detailItem}>
                                            <MaterialCommunityIcons name="counter" size={18} color={theme.textSecondary} />
                                            <Text style={styles.detailLabel}>Reps</Text>
                                            <Text style={styles.detailValue}>{exercise.reps}</Text>
                                        </View>
                                        <View style={styles.detailItem}>
                                            <MaterialCommunityIcons name="weight-kilogram" size={18} color={theme.textSecondary} />
                                            <Text style={styles.detailLabel}>Weight</Text>
                                            <Text style={styles.detailValue}>
                                                {exercise.unit === 'bodyweight'
                                                    ? 'Bodyweight'
                                                    : `${exercise.weight} ${exercise.unit}`}
                                            </Text>
                                        </View>
                                    </View>

                                    {exercise.resistance && (
                                        <View style={styles.resistanceRow}>
                                            <MaterialCommunityIcons name="elastic" size={18} color={theme.textSecondary} />
                                            <Text style={styles.resistanceLabel}>Resistance:</Text>
                                            <Text style={styles.resistanceValue}>{exercise.resistance}</Text>
                                        </View>
                                    )}

                                    {exercise.notes && (
                                        <View style={styles.notesContainer}>
                                            <MaterialCommunityIcons name="note-text-outline" size={18} color={theme.textSecondary} />
                                            <Text style={styles.notesText}>{exercise.notes}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>
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
        paddingBottom: 20,
        backgroundColor: theme.card,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.text,
        flex: 1,
        textAlign: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        padding: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 16,
        color: theme.textSecondary,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        fontSize: 16,
        color: theme.textSecondary,
        marginTop: 16,
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
    infoCard: {
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    infoHeader: {
        flexDirection: 'row',
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    infoContent: {
        flex: 1,
    },
    workoutName: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.text,
        marginBottom: 12,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    metaText: {
        fontSize: 14,
        color: theme.textSecondary,
        marginLeft: 8,
    },
    exercisesList: {
        gap: 12,
    },
    exerciseCard: {
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    exerciseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    exerciseNumber: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    exerciseNumberText: {
        fontSize: 14,
        fontWeight: '700',
        color: theme.primary,
    },
    exerciseName: {
        fontSize: 17,
        fontWeight: '600',
        color: theme.text,
        flex: 1,
    },
    exerciseDetails: {
        gap: 12,
    },
    detailRow: {
        flexDirection: 'row',
        gap: 12,
    },
    detailItem: {
        flex: 1,
        backgroundColor: theme.background,
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
    },
    detailLabel: {
        fontSize: 12,
        color: theme.textSecondary,
        marginTop: 4,
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 15,
        fontWeight: '700',
        color: theme.text,
    },
    resistanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.background,
        borderRadius: 12,
        padding: 12,
    },
    resistanceLabel: {
        fontSize: 14,
        color: theme.textSecondary,
        marginLeft: 8,
        marginRight: 4,
    },
    resistanceValue: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.text,
        flex: 1,
    },
    notesContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFBF0',
        borderRadius: 12,
        padding: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#FFD700',
    },
    notesText: {
        fontSize: 14,
        color: theme.textSecondary,
        marginLeft: 8,
        flex: 1,
        lineHeight: 20,
    },
    photosScroll: {
        marginTop: 12,
    },
    photoContainer: {
        marginRight: 12,
    },
    workoutPhoto: {
        width: 180,
        height: 180,
        borderRadius: 16,
        backgroundColor: theme.surface,
    },
});
