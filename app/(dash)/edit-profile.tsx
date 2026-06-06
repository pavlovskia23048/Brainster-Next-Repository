import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, TextInput, Image, ActivityIndicator } from 'react-native';
import { showAlert } from '@/utils/dialogs';
import React, { useState, useEffect, useMemo } from 'react';
import { Text } from '@/components/common/Text';
import { auth, db, storage } from '@/config/firebase';
import { useRouter } from 'expo-router';
import { safeBack } from '@/utils/navigation';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

type Sex = 'male' | 'female' | 'other';

export default function EditProfile() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const [displayName, setDisplayName] = useState(auth.currentUser?.displayName || '');
    const [email] = useState(auth.currentUser?.email || '');
    const [photoURL, setPhotoURL] = useState(auth.currentUser?.photoURL || '');
    const [newPhotoUri, setNewPhotoUri] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    const [heightCm, setHeightCm] = useState('');
    const [weightKg, setWeightKg] = useState('');
    const [age, setAge] = useState('');
    const [sex, setSex] = useState<Sex | ''>('');

    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

    useEffect(() => {
        const loadMetrics = async () => {
            const user = auth.currentUser;
            if (!user) return;
            try {
                const snap = await getDoc(doc(db, 'users', user.uid));
                const metrics = snap.data()?.bodyMetrics;
                if (metrics) {
                    setHeightCm(metrics.heightCm ? String(metrics.heightCm) : '');
                    setWeightKg(metrics.weightKg ? String(metrics.weightKg) : '');
                    setAge(metrics.age ? String(metrics.age) : '');
                    setSex(metrics.sex || '');
                }
            } catch (e) {
                console.warn('Failed to load body metrics', e);
            }
        };
        loadMetrics();
    }, []);

    const pickImage = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (!permissionResult.granted) {
                showAlert(
                    'Permission Required',
                    'Please allow access to your photo library to change your profile picture.'
                );
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
            });

            if (!result.canceled && result.assets[0]) {
                setNewPhotoUri(result.assets[0].uri);
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
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

            if (!permissionResult.granted) {
                showAlert(
                    'Permission Required',
                    'Please allow camera access to take a profile picture.'
                );
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
            });

            if (!result.canceled && result.assets[0]) {
                setNewPhotoUri(result.assets[0].uri);
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

    const handlePhotoPress = () => {
        showAlert(
            'Change Profile Photo',
            'Choose how you want to update your profile picture',
            [
                {
                    text: 'Take Photo',
                    onPress: takePhoto,
                },
                {
                    text: 'Choose from Library',
                    onPress: pickImage,
                },
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
            ]
        );
    };

    const uploadPhoto = async (userId: string): Promise<string | null> => {
        if (!newPhotoUri) return null;

        try {
            setUploadingPhoto(true);

            const response = await fetch(newPhotoUri);
            const blob = await response.blob();

            const filename = `profile_${Date.now()}.jpg`;
            const storageRef = ref(storage, `users/${userId}/profile/${filename}`);

            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);

            return downloadURL;
        } catch (error) {
            console.error('Error uploading photo:', error);
            throw error;
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleSave = async () => {
        if (!displayName.trim()) {
            Toast.show({
                type: 'error',
                text1: 'Name Required',
                text2: 'Please enter your name',
                position: 'top',
            });
            return;
        }

        setLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) return;

            let updatedPhotoURL = photoURL;

            // Upload new photo if selected
            if (newPhotoUri) {
                const uploadedURL = await uploadPhoto(user.uid);
                if (uploadedURL) {
                    updatedPhotoURL = uploadedURL;
                }
            }

            // Update Firebase Auth profile
            await updateProfile(user, {
                displayName: displayName.trim(),
                photoURL: updatedPhotoURL || null,
            });

            // Update Firestore user document
            const updateData: any = {
                displayName: displayName.trim(),
            };

            if (updatedPhotoURL) {
                updateData.photoURL = updatedPhotoURL;
            }

            const h = heightCm.trim() ? Number(heightCm) : null;
            const w = weightKg.trim() ? Number(weightKg) : null;
            const a = age.trim() ? Number(age) : null;
            const anyMetric = h !== null || w !== null || a !== null || sex !== '';
            if (anyMetric) {
                updateData.bodyMetrics = {
                    heightCm: h !== null && !isNaN(h) && h > 0 ? h : null,
                    weightKg: w !== null && !isNaN(w) && w > 0 ? w : null,
                    age: a !== null && !isNaN(a) && a > 0 ? a : null,
                    sex: sex || null,
                };
            }

            await updateDoc(doc(db, 'users', user.uid), updateData);

            Toast.show({
                type: 'success',
                text1: 'Success!',
                text2: 'Your profile has been updated',
                position: 'top',
            });

            safeBack(router);
        } catch (error: any) {
            console.error('Error updating profile:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to update profile',
                position: 'top',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router)}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSave}
                    disabled={loading}
                >
                    <Text style={[styles.saveText, loading && styles.saveTextDisabled]}>Save</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Avatar Section */}
                <View style={styles.avatarSection}>
                    <View style={styles.avatarContainer}>
                        <TouchableOpacity
                            style={styles.avatar}
                            onPress={handlePhotoPress}
                            activeOpacity={0.8}
                        >
                            {uploadingPhoto ? (
                                <ActivityIndicator size="large" color={theme.primary} />
                            ) : (newPhotoUri || photoURL) ? (
                                <Image
                                    source={{ uri: newPhotoUri || photoURL }}
                                    style={styles.avatarImage}
                                />
                            ) : (
                                <MaterialCommunityIcons name="account" size={56} color={theme.primary} />
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.cameraButton}
                            onPress={handlePhotoPress}
                        >
                            <MaterialCommunityIcons name="camera" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.avatarHint}>Change Photo</Text>
                </View>

                {/* Form Section */}
                <View style={styles.section}>
                    <View style={styles.formCard}>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Display Name</Text>
                            <View style={styles.inputContainer}>
                                <MaterialCommunityIcons name="account-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your name"
                                    placeholderTextColor={theme.textTertiary}
                                    value={displayName}
                                    onChangeText={setDisplayName}
                                    autoCapitalize="words"
                                />
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Email</Text>
                            <View style={[styles.inputContainer, styles.disabledInput]}>
                                <MaterialCommunityIcons name="email-outline" size={20} color={theme.textTertiary} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, styles.disabledInputText]}
                                    value={email}
                                    editable={false}
                                />
                            </View>
                            <Text style={styles.hint}>Email cannot be changed</Text>
                        </View>
                    </View>
                </View>

                {/* Body Metrics Section — used by AI plan generation */}
                <View style={styles.section}>
                    <View style={styles.formCard}>
                        <View style={styles.metricsHeader}>
                            <MaterialCommunityIcons name="human" size={20} color={theme.primary} />
                            <Text style={styles.metricsTitle}>Body Metrics</Text>
                        </View>
                        <Text style={styles.metricsSubtitle}>
                            Used by the AI to recommend realistic weights in kilograms.
                        </Text>

                        <View style={styles.metricsRow}>
                            <View style={[styles.formGroup, styles.metricsHalf]}>
                                <Text style={styles.label}>Height (cm)</Text>
                                <View style={styles.inputContainer}>
                                    <MaterialCommunityIcons name="human-male-height" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="180"
                                        placeholderTextColor={theme.textTertiary}
                                        value={heightCm}
                                        onChangeText={setHeightCm}
                                        keyboardType="numeric"
                                        maxLength={3}
                                    />
                                </View>
                            </View>

                            <View style={[styles.formGroup, styles.metricsHalf]}>
                                <Text style={styles.label}>Weight (kg)</Text>
                                <View style={styles.inputContainer}>
                                    <MaterialCommunityIcons name="weight-kilogram" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="75"
                                        placeholderTextColor={theme.textTertiary}
                                        value={weightKg}
                                        onChangeText={setWeightKg}
                                        keyboardType="numeric"
                                        maxLength={5}
                                    />
                                </View>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Age</Text>
                            <View style={styles.inputContainer}>
                                <MaterialCommunityIcons name="calendar-account" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="25"
                                    placeholderTextColor={theme.textTertiary}
                                    value={age}
                                    onChangeText={setAge}
                                    keyboardType="number-pad"
                                    maxLength={3}
                                />
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Sex</Text>
                            <View style={styles.sexRow}>
                                {(['male', 'female', 'other'] as Sex[]).map((option) => (
                                    <TouchableOpacity
                                        key={option}
                                        style={[
                                            styles.sexChip,
                                            sex === option && styles.sexChipActive,
                                        ]}
                                        onPress={() => setSex(option)}
                                    >
                                        <Text
                                            style={[
                                                styles.sexChipText,
                                                sex === option && styles.sexChipTextActive,
                                            ]}
                                        >
                                            {option.charAt(0).toUpperCase() + option.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>
                </View>

                {/* Info Card */}
                <View style={[styles.section, { marginBottom: 100 }]}>
                    <View style={styles.infoCard}>
                        <MaterialCommunityIcons name="information-outline" size={20} color={theme.primary} />
                        <Text style={styles.infoText}>
                            Your display name will be visible to other users when you participate in challenges.
                        </Text>
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
    saveButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    saveText: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.primary,
    },
    saveTextDisabled: {
        opacity: 0.5,
    },
    avatarSection: {
        alignItems: 'center',
        paddingVertical: 32,
        backgroundColor: theme.card,
        marginBottom: 24,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 12,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: theme.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    cameraButton: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: theme.card,
    },
    avatarHint: {
        fontSize: 14,
        color: theme.primary,
        fontWeight: '600',
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    formCard: {
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: isDark ? 1 : 0,
        borderColor: theme.border,
    },
    formGroup: {
        marginBottom: 0,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.textSecondary,
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.surface,
        borderRadius: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: theme.border,
    },
    disabledInput: {
        backgroundColor: theme.surface,
        borderColor: theme.border,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        paddingVertical: 14,
        fontSize: 16,
        color: theme.text,
        fontWeight: '500',
    },
    disabledInputText: {
        color: theme.textSecondary,
    },
    hint: {
        fontSize: 12,
        color: theme.textSecondary,
        marginTop: 8,
    },
    divider: {
        height: 1,
        backgroundColor: theme.border,
        marginVertical: 20,
    },
    infoCard: {
        flexDirection: 'row',
        backgroundColor: theme.primaryLight,
        borderRadius: 12,
        padding: 16,
        gap: 12,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: theme.textSecondary,
        lineHeight: 18,
    },
    metricsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    metricsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.text,
    },
    metricsSubtitle: {
        fontSize: 13,
        color: theme.textSecondary,
        marginBottom: 16,
        lineHeight: 18,
    },
    metricsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    metricsHalf: {
        flex: 1,
    },
    sexRow: {
        flexDirection: 'row',
        gap: 8,
    },
    sexChip: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        alignItems: 'center',
    },
    sexChipActive: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
    },
    sexChipText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.text,
    },
    sexChipTextActive: {
        color: '#FFFFFF',
    },
});
