import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, TextInput, Platform, ActivityIndicator, Image } from 'react-native';
import React, { useState, useEffect, useMemo } from 'react';
import { Text } from '@/components/common/Text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '@/utils/navigation';
import { auth, db, storage } from '@/config/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, increment, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';
import DateTimePicker from '@react-native-community/datetimepicker';
import { updateUserLevel, getLevelData } from '@/utils/levelSystem';
import { sendFirstWorkoutNotification, sendStreakNotification, sendLevelUpNotification } from '@/utils/notifications';

interface Exercise {
    id: string;
    name: string;
    sets: number;
    reps: number;
    weight: string;
    unit: 'kg' | 'lbs' | 'bodyweight';
    resistance: string; // For bands
    notes: string;
}

export default function CreateWorkout() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const { id, fromPlan } = useLocalSearchParams(); // Get workout ID if editing, or fromPlan if starting from AI plan
    const isEditing = !!id;

    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

    const [workoutId, setWorkoutId] = useState<string | null>(id as string || null);
    const [loading, setLoading] = useState(isEditing);
    const [workoutName, setWorkoutName] = useState('');
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [showExerciseForm, setShowExerciseForm] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    // Workout date and weight
    const [workoutDate, setWorkoutDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [bodyWeight, setBodyWeight] = useState('');
    const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');

    // Photos
    const [photos, setPhotos] = useState<string[]>([]);
    const [uploadingPhotos, setUploadingPhotos] = useState(false);

    // Exercise form state
    const [exerciseName, setExerciseName] = useState('');
    const [sets, setSets] = useState('3');
    const [reps, setReps] = useState('10');
    const [weight, setWeight] = useState('');
    const [unit, setUnit] = useState<'kg' | 'lbs' | 'bodyweight'>('kg');
    const [resistance, setResistance] = useState('');
    const [notes, setNotes] = useState('');

    // Load workout data if editing, or pre-fill from AI plan
    useEffect(() => {
        if (isEditing && id) {
            loadWorkout(id as string);
        } else if (fromPlan) {
            try {
                const planData = JSON.parse(fromPlan as string);
                if (planData.workoutName) setWorkoutName(planData.workoutName);
                if (Array.isArray(planData.exercises)) {
                    setExercises(planData.exercises.map((ex: any, index: number) => ({
                        id: ex.id || `plan-${index}-${Date.now()}`,
                        name: ex.name || '',
                        sets: ex.sets || 3,
                        reps: ex.reps || 10,
                        weight: ex.weight || '',
                        unit: ex.unit || 'kg',
                        resistance: ex.resistance || '',
                        notes: ex.notes || '',
                    })));
                }
            } catch (e) {
                console.error('Error parsing fromPlan data:', e);
            }
        }
    }, [id, fromPlan]);

    const loadWorkout = async (workoutId: string) => {
        try {
            setLoading(true);
            const workoutDoc = await getDoc(doc(db, 'workoutLogs', workoutId));

            if (workoutDoc.exists()) {
                const data = workoutDoc.data();
                setWorkoutName(data.workoutName || '');
                setWorkoutDate(data.date?.toDate() || new Date());

                // Load exercises with proper IDs
                const loadedExercises = (data.exercises || []).map((ex: any, index: number) => ({
                    id: `${Date.now()}-${index}`,
                    name: ex.name || '',
                    sets: ex.sets || 3,
                    reps: ex.reps || 10,
                    weight: ex.weight || '',
                    unit: ex.unit || 'kg',
                    resistance: ex.resistance || '',
                    notes: ex.notes || '',
                }));
                setExercises(loadedExercises);

                // Try to load weight measurement for this workout date
                // Note: This is a simplified approach - in production you'd query by date
            }
        } catch (error) {
            console.error('Error loading workout:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to load workout data',
                position: 'top',
            });
        } finally {
            setLoading(false);
        }
    };

    const resetExerciseForm = () => {
        setExerciseName('');
        setSets('3');
        setReps('10');
        setWeight('');
        setUnit('kg');
        setResistance('');
        setNotes('');
        setEditingIndex(null);
    };

    const handleAddExercise = () => {
        if (!exerciseName.trim()) {
            Toast.show({
                type: 'error',
                text1: 'Exercise Name Required',
                text2: 'Please enter an exercise name',
                position: 'top',
            });
            return;
        }

        const exercise: Exercise = {
            id: Date.now().toString(),
            name: exerciseName.trim(),
            sets: parseInt(sets) || 3,
            reps: parseInt(reps) || 10,
            weight: weight.trim(),
            unit,
            resistance: resistance.trim(),
            notes: notes.trim(),
        };

        if (editingIndex !== null) {
            const updatedExercises = [...exercises];
            updatedExercises[editingIndex] = exercise;
            setExercises(updatedExercises);
        } else {
            setExercises([...exercises, exercise]);
        }

        resetExerciseForm();
        setShowExerciseForm(false);
    };

    const handleEditExercise = (index: number) => {
        const exercise = exercises[index];
        setExerciseName(exercise.name);
        setSets(exercise.sets.toString());
        setReps(exercise.reps.toString());
        setWeight(exercise.weight);
        setUnit(exercise.unit);
        setResistance(exercise.resistance);
        setNotes(exercise.notes);
        setEditingIndex(index);
        setShowExerciseForm(true);
    };

    const handleDeleteExercise = (index: number) => {
        const updatedExercises = exercises.filter((_, i) => i !== index);
        setExercises(updatedExercises);
    };

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (status !== 'granted') {
                Toast.show({
                    type: 'error',
                    text1: 'Permission Required',
                    text2: 'Please allow access to your photos',
                    position: 'top',
                });
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.7,
                aspect: [4, 3],
            });

            if (!result.canceled && result.assets) {
                const newPhotos = result.assets.map(asset => asset.uri);
                setPhotos(prev => [...prev, ...newPhotos]);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to pick image',
                position: 'top',
            });
        }
    };

    const takePhoto = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();

            if (status !== 'granted') {
                Toast.show({
                    type: 'error',
                    text1: 'Permission Required',
                    text2: 'Please allow access to your camera',
                    position: 'top',
                });
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                quality: 0.7,
                aspect: [4, 3],
            });

            if (!result.canceled && result.assets && result.assets[0]) {
                setPhotos(prev => [...prev, result.assets[0].uri]);
            }
        } catch (error) {
            console.error('Error taking photo:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to take photo',
                position: 'top',
            });
        }
    };

    const removePhoto = (index: number) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const uploadPhotos = async (userId: string, workoutId: string): Promise<string[]> => {
        if (photos.length === 0) return [];

        setUploadingPhotos(true);
        const uploadedUrls: string[] = [];

        try {
            for (let i = 0; i < photos.length; i++) {
                const photo = photos[i];
                const response = await fetch(photo);
                const blob = await response.blob();

                const filename = `${Date.now()}_${i}.jpg`;
                const storageRef = ref(storage, `workouts/${userId}/${workoutId}/${filename}`);

                await uploadBytes(storageRef, blob);
                const downloadURL = await getDownloadURL(storageRef);
                uploadedUrls.push(downloadURL);
            }

            return uploadedUrls;
        } catch (error) {
            console.error('Error uploading photos:', error);
            Toast.show({
                type: 'error',
                text1: 'Photo Upload Failed',
                text2: 'Some photos could not be uploaded',
                position: 'top',
            });
            return uploadedUrls; // Return what we managed to upload
        } finally {
            setUploadingPhotos(false);
        }
    };

    const handleSaveWorkout = async () => {
        if (!workoutName.trim()) {
            Toast.show({
                type: 'error',
                text1: 'Workout Name Required',
                text2: 'Please enter a workout name',
                position: 'top',
            });
            return;
        }

        if (exercises.length === 0) {
            Toast.show({
                type: 'error',
                text1: 'Add Exercises',
                text2: 'Please add at least one exercise',
                position: 'top',
            });
            return;
        }

        try {
            const currentUser = auth.currentUser;
            if (!currentUser) return;

            // Calculate estimated duration (5 min per exercise as a baseline)
            const duration = exercises.length * 5;

            // Convert workout date to Timestamp
            const workoutTimestamp = Timestamp.fromDate(workoutDate);

            const workoutData = {
                userId: currentUser.uid,
                workoutName: workoutName.trim(),
                date: workoutTimestamp,
                duration,
                exercises: exercises.map(ex => ({
                    name: ex.name,
                    sets: ex.sets,
                    reps: ex.reps,
                    weight: ex.weight,
                    unit: ex.unit,
                    resistance: ex.resistance,
                    notes: ex.notes,
                })),
            };

            if (isEditing && workoutId) {
                // Update existing workout
                const workoutRef = doc(db, 'workoutLogs', workoutId);

                // Upload new photos if any
                let photoUrls: string[] = [];
                if (photos.length > 0) {
                    photoUrls = await uploadPhotos(currentUser.uid, workoutId);
                }

                await updateDoc(workoutRef, {
                    ...workoutData,
                    ...(photoUrls.length > 0 && { photos: photoUrls }),
                });
            } else {
                // Create new workout
                const docRef = await addDoc(collection(db, 'workoutLogs'), {
                    ...workoutData,
                    createdAt: serverTimestamp(),
                });

                // Upload photos if any
                if (photos.length > 0) {
                    const photoUrls = await uploadPhotos(currentUser.uid, docRef.id);
                    // Update the workout document with photo URLs
                    if (photoUrls.length > 0) {
                        await updateDoc(docRef, { photos: photoUrls });
                    }
                }

                // Get user data before updating
                const userRef = doc(db, 'users', currentUser.uid);
                const userDocBefore = await getDoc(userRef);
                const userDataBefore = userDocBefore.data();
                const oldLevel = userDataBefore?.stats?.level || 1;
                const oldTotalWorkouts = userDataBefore?.stats?.totalWorkouts || 0;

                // Update user stats only for new workouts
                await updateDoc(userRef, {
                    'stats.totalWorkouts': increment(1),
                    'stats.points': increment(10),
                });

                // Check if this is the first workout
                if (oldTotalWorkouts === 0) {
                    await sendFirstWorkoutNotification(currentUser.uid);
                }

                // Get updated points and update level
                const updatedUserDoc = await getDoc(userRef);
                if (updatedUserDoc.exists()) {
                    const currentPoints = updatedUserDoc.data().stats?.points || 0;
                    await updateUserLevel(currentUser.uid, currentPoints);

                    // Check if level increased
                    const newUserDoc = await getDoc(userRef);
                    const newLevel = newUserDoc.data()?.stats?.level || 1;
                    if (newLevel > oldLevel) {
                        const levelData = getLevelData(newLevel);
                        await sendLevelUpNotification(currentUser.uid, newLevel, levelData.name);
                    }
                }

                // Update streak based on the workout date and get the new streak value
                const newStreak = await updateUserStreak(currentUser.uid, workoutDate);

                // Send streak milestone notification if applicable
                if (newStreak !== null) {
                    await sendStreakNotification(currentUser.uid, newStreak);
                }
            }

            // Save body weight measurement if provided
            if (bodyWeight.trim()) {
                await addDoc(collection(db, 'measurements'), {
                    userId: currentUser.uid,
                    date: workoutTimestamp,
                    weight: parseFloat(bodyWeight),
                    unit: weightUnit,
                    createdAt: serverTimestamp(),
                });
            }

            Toast.show({
                type: 'success',
                text1: isEditing ? 'Workout Updated!' : 'Workout Saved!',
                text2: isEditing
                    ? 'Your workout has been updated successfully'
                    : bodyWeight.trim()
                    ? 'Workout and weight measurement logged successfully'
                    : 'Your workout has been logged successfully',
                position: 'top',
            });

            safeBack(router);
        } catch (error) {
            console.error('Error saving workout:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: `Failed to ${isEditing ? 'update' : 'save'} workout`,
                position: 'top',
            });
        }
    };

    const updateUserStreak = async (userId: string, workoutDate: Date): Promise<number | null> => {
        try {
            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                const lastWorkoutDate = userData.lastWorkoutDate?.toDate();
                const selectedDate = new Date(workoutDate);
                selectedDate.setHours(0, 0, 0, 0);

                let newStreak = 1;

                if (lastWorkoutDate) {
                    const lastDate = new Date(lastWorkoutDate);
                    lastDate.setHours(0, 0, 0, 0);

                    const diffTime = selectedDate.getTime() - lastDate.getTime();
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays === 0) {
                        // Same day, don't update streak
                        return null;
                    } else if (diffDays === 1) {
                        // Consecutive day, increment streak
                        newStreak = (userData.stats?.streak || 0) + 1;
                    } else if (diffDays < 0) {
                        // Adding workout for a past date, don't update streak
                        return null;
                    }
                    // else: streak broken, reset to 1
                }

                await updateDoc(userRef, {
                    'stats.streak': newStreak,
                    lastWorkoutDate: Timestamp.fromDate(workoutDate),
                });

                return newStreak;
            }
        } catch (error) {
            console.error('Error updating streak:', error);
        }
        return null;
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={styles.loadingText}>Loading workout...</Text>
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
                    <MaterialCommunityIcons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isEditing ? 'Edit Workout' : 'New Workout'}</Text>
                <TouchableOpacity onPress={handleSaveWorkout}>
                    <Text style={styles.saveText}>Save</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Workout Name */}
                <View style={styles.section}>
                    <Text style={styles.label}>Workout Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g., Upper Body, Leg Day"
                        placeholderTextColor={theme.textTertiary}
                        value={workoutName}
                        onChangeText={setWorkoutName}
                    />
                </View>

                {/* Workout Date */}
                <View style={styles.section}>
                    <Text style={styles.label}>Workout Date</Text>
                    <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => setShowDatePicker(true)}
                    >
                        <MaterialCommunityIcons name="calendar" size={20} color={theme.primary} />
                        <Text style={styles.dateButtonText}>
                            {workoutDate.toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            })}
                        </Text>
                    </TouchableOpacity>
                    {showDatePicker && (
                        <DateTimePicker
                            value={workoutDate}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event, selectedDate) => {
                                setShowDatePicker(Platform.OS === 'ios');
                                if (selectedDate) {
                                    setWorkoutDate(selectedDate);
                                }
                            }}
                            maximumDate={new Date()}
                        />
                    )}
                </View>

                {/* Body Weight Measurement */}
                <View style={styles.section}>
                    <Text style={styles.label}>Body Weight (optional)</Text>
                    <View style={styles.weightContainer}>
                        <TextInput
                            style={styles.weightInput}
                            placeholder="Enter your weight"
                            placeholderTextColor={theme.textTertiary}
                            value={bodyWeight}
                            onChangeText={setBodyWeight}
                            keyboardType="decimal-pad"
                        />
                        <View style={styles.weightUnitSelector}>
                            <TouchableOpacity
                                style={[styles.weightUnitOption, weightUnit === 'kg' && styles.weightUnitOptionActive]}
                                onPress={() => setWeightUnit('kg')}
                            >
                                <Text style={[styles.weightUnitText, weightUnit === 'kg' && styles.weightUnitTextActive]}>kg</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.weightUnitOption, weightUnit === 'lbs' && styles.weightUnitOptionActive]}
                                onPress={() => setWeightUnit('lbs')}
                            >
                                <Text style={[styles.weightUnitText, weightUnit === 'lbs' && styles.weightUnitTextActive]}>lbs</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Photos Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.label}>Workout Photos (optional)</Text>
                    </View>

                    {photos.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosContainer}>
                            {photos.map((photo, index) => (
                                <View key={index} style={styles.photoItem}>
                                    <Image source={{ uri: photo }} style={styles.photoImage} />
                                    <TouchableOpacity
                                        style={styles.removePhotoButton}
                                        onPress={() => removePhoto(index)}
                                    >
                                        <MaterialCommunityIcons name="close-circle" size={24} color="#FF6B6B" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    )}

                    <View style={styles.photoActions}>
                        <TouchableOpacity style={styles.photoActionButton} onPress={pickImage}>
                            <MaterialCommunityIcons name="image-multiple" size={20} color={theme.primary} />
                            <Text style={styles.photoActionText}>Choose from Gallery</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.photoActionButton} onPress={takePhoto}>
                            <MaterialCommunityIcons name="camera" size={20} color={theme.primary} />
                            <Text style={styles.photoActionText}>Take Photo</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Exercises List */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Exercises ({exercises.length})</Text>
                        {!showExerciseForm && (
                            <TouchableOpacity
                                style={styles.addExerciseButton}
                                onPress={() => setShowExerciseForm(true)}
                            >
                                <MaterialCommunityIcons name="plus" size={20} color={theme.primary} />
                                <Text style={styles.addExerciseText}>Add Exercise</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {exercises.map((exercise, index) => (
                        <View key={exercise.id} style={styles.exerciseCard}>
                            <View style={styles.exerciseHeader}>
                                <Text style={styles.exerciseName}>{exercise.name}</Text>
                                <View style={styles.exerciseActions}>
                                    <TouchableOpacity onPress={() => handleEditExercise(index)} style={styles.iconButton}>
                                        <MaterialCommunityIcons name="pencil" size={20} color={theme.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDeleteExercise(index)} style={styles.iconButton}>
                                        <MaterialCommunityIcons name="delete-outline" size={20} color="#FF6B6B" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <View style={styles.exerciseDetails}>
                                <View style={styles.detailBadge}>
                                    <MaterialCommunityIcons name="replay" size={14} color={theme.textSecondary} />
                                    <Text style={styles.detailText}>{exercise.sets} sets</Text>
                                </View>
                                <View style={styles.detailBadge}>
                                    <MaterialCommunityIcons name="counter" size={14} color={theme.textSecondary} />
                                    <Text style={styles.detailText}>{exercise.reps} reps</Text>
                                </View>
                                {exercise.weight && (
                                    <View style={styles.detailBadge}>
                                        <MaterialCommunityIcons name="weight" size={14} color={theme.textSecondary} />
                                        <Text style={styles.detailText}>{exercise.weight} {exercise.unit}</Text>
                                    </View>
                                )}
                                {exercise.resistance && (
                                    <View style={styles.detailBadge}>
                                        <MaterialCommunityIcons name="resistor" size={14} color={theme.textSecondary} />
                                        <Text style={styles.detailText}>{exercise.resistance}</Text>
                                    </View>
                                )}
                            </View>
                            {exercise.notes && (
                                <Text style={styles.exerciseNotes}>{exercise.notes}</Text>
                            )}
                        </View>
                    ))}
                </View>

                {/* Exercise Form */}
                {showExerciseForm && (
                    <View style={[styles.section, { marginBottom: 100 }]}>
                        <View style={styles.formCard}>
                            <Text style={styles.formTitle}>{editingIndex !== null ? 'Edit Exercise' : 'Add Exercise'}</Text>

                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Exercise Name *</Text>
                                <TextInput
                                    style={styles.formInput}
                                    placeholder="e.g., Bench Press, Squats"
                                    placeholderTextColor={theme.textTertiary}
                                    value={exerciseName}
                                    onChangeText={setExerciseName}
                                />
                            </View>

                            <View style={styles.formRow}>
                                <View style={styles.formGroupHalf}>
                                    <Text style={styles.formLabel}>Sets</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="3"
                                        placeholderTextColor={theme.textTertiary}
                                        value={sets}
                                        onChangeText={setSets}
                                        keyboardType="number-pad"
                                    />
                                </View>
                                <View style={styles.formGroupHalf}>
                                    <Text style={styles.formLabel}>Reps</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="10"
                                        placeholderTextColor={theme.textTertiary}
                                        value={reps}
                                        onChangeText={setReps}
                                        keyboardType="number-pad"
                                    />
                                </View>
                            </View>

                            <View style={styles.formRow}>
                                <View style={styles.formGroupHalf}>
                                    <Text style={styles.formLabel}>Weight</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="50"
                                        placeholderTextColor={theme.textTertiary}
                                        value={weight}
                                        onChangeText={setWeight}
                                        keyboardType="decimal-pad"
                                    />
                                </View>
                                <View style={styles.formGroupHalf}>
                                    <Text style={styles.formLabel}>Unit</Text>
                                    <View style={styles.unitSelector}>
                                        <TouchableOpacity
                                            style={[styles.unitOption, unit === 'kg' && styles.unitOptionActive]}
                                            onPress={() => setUnit('kg')}
                                        >
                                            <Text style={[styles.unitText, unit === 'kg' && styles.unitTextActive]}>kg</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.unitOption, unit === 'lbs' && styles.unitOptionActive]}
                                            onPress={() => setUnit('lbs')}
                                        >
                                            <Text style={[styles.unitText, unit === 'lbs' && styles.unitTextActive]}>lbs</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.unitOption, unit === 'bodyweight' && styles.unitOptionActive]}
                                            onPress={() => setUnit('bodyweight')}
                                        >
                                            <Text style={[styles.unitText, unit === 'bodyweight' && styles.unitTextActive]}>BW</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Resistance Band (optional)</Text>
                                <TextInput
                                    style={styles.formInput}
                                    placeholder="e.g., Red band, 20lbs"
                                    placeholderTextColor={theme.textTertiary}
                                    value={resistance}
                                    onChangeText={setResistance}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Notes (optional)</Text>
                                <TextInput
                                    style={[styles.formInput, styles.textArea]}
                                    placeholder="Add any notes about this exercise..."
                                    placeholderTextColor={theme.textTertiary}
                                    value={notes}
                                    onChangeText={setNotes}
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>

                            <View style={styles.formActions}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => {
                                        resetExerciseForm();
                                        setShowExerciseForm(false);
                                    }}
                                >
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.submitButton} onPress={handleAddExercise}>
                                    <Text style={styles.submitButtonText}>
                                        {editingIndex !== null ? 'Update' : 'Add'} Exercise
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}

                {!showExerciseForm && exercises.length === 0 && (
                    <View style={[styles.section, { marginBottom: 100 }]}>
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="weight-lifter" size={48} color={theme.textTertiary} />
                            <Text style={styles.emptyText}>No exercises added yet</Text>
                            <Text style={styles.emptySubtext}>Tap "Add Exercise" to get started</Text>
                        </View>
                    </View>
                )}
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
    saveText: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.primary,
    },
    section: {
        paddingHorizontal: 20,
        marginTop: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.textSecondary,
        marginBottom: 8,
    },
    input: {
        backgroundColor: theme.card,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: theme.text,
        borderWidth: 1,
        borderColor: theme.border,
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.card,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: theme.border,
        gap: 10,
    },
    dateButtonText: {
        fontSize: 16,
        color: theme.text,
        fontWeight: '500',
    },
    weightContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    weightInput: {
        flex: 1,
        backgroundColor: theme.card,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: theme.text,
        borderWidth: 1,
        borderColor: theme.border,
    },
    weightUnitSelector: {
        flexDirection: 'row',
        gap: 8,
    },
    weightUnitOption: {
        backgroundColor: theme.card,
        borderRadius: 12,
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: theme.border,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 60,
    },
    weightUnitOptionActive: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
    },
    weightUnitText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.textSecondary,
    },
    weightUnitTextActive: {
        color: '#FFFFFF',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.text,
    },
    addExerciseButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    addExerciseText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.primary,
    },
    exerciseCard: {
        backgroundColor: theme.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    exerciseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    exerciseName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.text,
        flex: 1,
    },
    exerciseActions: {
        flexDirection: 'row',
        gap: 8,
    },
    iconButton: {
        padding: 4,
    },
    exerciseDetails: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    detailBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: theme.background,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    detailText: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.textSecondary,
    },
    exerciseNotes: {
        fontSize: 13,
        color: theme.textSecondary,
        marginTop: 12,
        fontStyle: 'italic',
    },
    formCard: {
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 20,
    },
    formTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.text,
        marginBottom: 20,
    },
    formGroup: {
        marginBottom: 16,
    },
    formLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.textSecondary,
        marginBottom: 8,
    },
    formInput: {
        backgroundColor: theme.background,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        color: theme.text,
        borderWidth: 1,
        borderColor: theme.border,
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    formRow: {
        flexDirection: 'row',
        gap: 12,
    },
    formGroupHalf: {
        flex: 1,
        marginBottom: 16,
    },
    unitSelector: {
        flexDirection: 'row',
        gap: 8,
    },
    unitOption: {
        flex: 1,
        backgroundColor: theme.background,
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.border,
    },
    unitOptionActive: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
    },
    unitText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.textSecondary,
    },
    unitTextActive: {
        color: '#FFFFFF',
    },
    formActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: theme.surface,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: theme.textSecondary,
    },
    submitButton: {
        flex: 1,
        backgroundColor: theme.primary,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    submitButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.textSecondary,
        marginTop: 12,
        marginBottom: 4,
    },
    emptySubtext: {
        fontSize: 14,
        color: theme.textSecondary,
    },
    photosContainer: {
        marginBottom: 16,
    },
    photoItem: {
        marginRight: 12,
        position: 'relative',
    },
    photoImage: {
        width: 120,
        height: 120,
        borderRadius: 12,
        backgroundColor: theme.surface,
    },
    removePhotoButton: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: theme.card,
        borderRadius: 12,
    },
    photoActions: {
        flexDirection: 'row',
        gap: 12,
    },
    photoActionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.primaryLight,
        borderRadius: 12,
        paddingVertical: 14,
        gap: 8,
        borderWidth: 1,
        borderColor: theme.border,
    },
    photoActionText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.primary,
    },
});
