import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, TextInput, ActivityIndicator } from 'react-native';
import { showAlert } from '@/utils/dialogs';
import React, { useState, useMemo } from 'react';
import { Text } from '@/components/common/Text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeBack } from '@/utils/navigation';
import { auth, db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const STEPS = [
    { key: 'fitnessGoal', title: 'What is your fitness goal?', icon: 'target' as const },
    { key: 'experienceLevel', title: 'What is your experience level?', icon: 'arm-flex' as const },
    { key: 'weeklyFrequency', title: 'How many times per week?', icon: 'calendar-week' as const },
    { key: 'availableEquipment', title: 'What equipment do you have?', icon: 'dumbbell' as const },
    { key: 'sessionDuration', title: 'How long are your sessions?', icon: 'clock-outline' as const },
    { key: 'injuries', title: 'Any injuries or limitations?', icon: 'medical-bag' as const },
];

const GOALS = [
    { value: 'build_muscle', label: 'Build Muscle', icon: 'arm-flex' },
    { value: 'lose_weight', label: 'Lose Weight', icon: 'fire' },
    { value: 'endurance', label: 'Improve Endurance', icon: 'run-fast' },
    { value: 'maintain', label: 'Maintain Fitness', icon: 'shield-check' },
    { value: 'flexibility', label: 'Flexibility', icon: 'yoga' },
];

const EXPERIENCE = [
    { value: 'beginner', label: 'Beginner', desc: 'Less than 6 months' },
    { value: 'intermediate', label: 'Intermediate', desc: '6 months to 2 years' },
    { value: 'advanced', label: 'Advanced', desc: 'Over 2 years' },
];

const FREQUENCY = [2, 3, 4, 5, 6];

const EQUIPMENT = [
    { value: 'bodyweight_only', label: 'Bodyweight Only', icon: 'human-handsup' },
    { value: 'dumbbells', label: 'Dumbbells', icon: 'dumbbell' },
    { value: 'barbell', label: 'Barbell', icon: 'weight-lifter' },
    { value: 'machines', label: 'Machines', icon: 'cog' },
    { value: 'bands', label: 'Resistance Bands', icon: 'connection' },
];

const DURATIONS = [
    { value: 30, label: '30 min' },
    { value: 45, label: '45 min' },
    { value: 60, label: '60 min' },
    { value: 90, label: '90 min' },
];

interface Questionnaire {
    fitnessGoal: string;
    experienceLevel: string;
    weeklyFrequency: number;
    availableEquipment: string[];
    sessionDuration: number;
    injuries: string;
}

export default function AIQuestionnaire() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

    const [currentStep, setCurrentStep] = useState(0);
    const [generating, setGenerating] = useState(false);
    const [questionnaire, setQuestionnaire] = useState<Questionnaire>({
        fitnessGoal: '',
        experienceLevel: '',
        weeklyFrequency: 3,
        availableEquipment: [],
        sessionDuration: 60,
        injuries: '',
    });

    const canProceed = () => {
        switch (currentStep) {
            case 0: return questionnaire.fitnessGoal !== '';
            case 1: return questionnaire.experienceLevel !== '';
            case 2: return questionnaire.weeklyFrequency > 0;
            case 3: return questionnaire.availableEquipment.length > 0;
            case 4: return questionnaire.sessionDuration > 0;
            case 5: return true; // injuries is optional
            default: return false;
        }
    };

    const toggleEquipment = (value: string) => {
        setQuestionnaire(prev => {
            const current = prev.availableEquipment;
            if (current.includes(value)) {
                return { ...prev, availableEquipment: current.filter(e => e !== value) };
            }
            return { ...prev, availableEquipment: [...current, value] };
        });
    };

    const callGenerate = async (
        bodyMetrics: { heightCm?: number | null; weightKg?: number | null; age?: number | null; sex?: string | null } | undefined,
        gamificationLevel: number
    ) => {
        setGenerating(true);
        try {
            const functions = getFunctions();
            const generatePlan = httpsCallable(functions, 'generateWorkoutPlan');
            const result = await generatePlan({
                questionnaire,
                bodyMetrics,
                gamificationLevel,
            });
            const data = result.data as { planId: string };

            Toast.show({
                type: 'success',
                text1: 'Plan Generated!',
                text2: 'Your personalized workout plan is ready.',
                position: 'top',
            });

            router.replace({ pathname: '/(dash)/plan-detail', params: { id: data.planId } });
        } catch (error: any) {
            const message = error?.message || 'Failed to generate plan';
            if (message.includes('monthly limit') || message.includes('resource-exhausted')) {
                router.push('/(dash)/subscription');
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: message,
                    position: 'top',
                });
            }
        } finally {
            setGenerating(false);
        }
    };

    const handleGenerate = async () => {
        const user = auth.currentUser;
        if (!user) return;

        let bodyMetrics: { heightCm?: number | null; weightKg?: number | null; age?: number | null; sex?: string | null } | undefined;
        let gamificationLevel = 1;
        let tier = 'free';
        let currentGenerations = 0;

        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                tier = data.subscriptionTier || 'free';
                const generations = data.monthlyAiGenerations || 0;
                const lastReset = data.lastGenerationReset?.toDate() || new Date(0);
                const daysSinceReset = (Date.now() - lastReset.getTime()) / (1000 * 60 * 60 * 24);
                currentGenerations = daysSinceReset >= 30 ? 0 : generations;
                bodyMetrics = data.bodyMetrics;
                gamificationLevel = data.stats?.level ?? 1;
            }
        } catch {
            // Continue to server-side check
        }

        if (tier === 'free' && currentGenerations >= 3) {
            router.push('/(dash)/subscription');
            return;
        }

        const missingMetrics =
            !bodyMetrics ||
            !bodyMetrics.weightKg ||
            !bodyMetrics.heightCm ||
            !bodyMetrics.age;

        if (missingMetrics) {
            showAlert(
                'Body Metrics Missing',
                'For accurate weight (kg) recommendations the AI needs your height, weight and age. Add them in your profile, or continue with generic ranges.',
                [
                    {
                        text: 'Edit Profile',
                        onPress: () => router.push('/(dash)/edit-profile'),
                    },
                    {
                        text: 'Continue Anyway',
                        style: 'cancel',
                        onPress: () => callGenerate(bodyMetrics, gamificationLevel),
                    },
                ]
            );
            return;
        }

        await callGenerate(bodyMetrics, gamificationLevel);
    };

    const renderStep = () => {
        switch (currentStep) {
            case 0:
                return (
                    <View style={styles.optionsContainer}>
                        {GOALS.map(goal => (
                            <TouchableOpacity
                                key={goal.value}
                                style={[
                                    styles.optionCard,
                                    questionnaire.fitnessGoal === goal.value && styles.optionCardSelected,
                                ]}
                                onPress={() => setQuestionnaire(prev => ({ ...prev, fitnessGoal: goal.value }))}
                            >
                                <MaterialCommunityIcons
                                    name={goal.icon as any}
                                    size={28}
                                    color={questionnaire.fitnessGoal === goal.value ? '#FFFFFF' : theme.primary}
                                />
                                <Text style={[
                                    styles.optionLabel,
                                    questionnaire.fitnessGoal === goal.value && styles.optionLabelSelected,
                                ]}>
                                    {goal.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                );

            case 1:
                return (
                    <View style={styles.optionsContainer}>
                        {EXPERIENCE.map(exp => (
                            <TouchableOpacity
                                key={exp.value}
                                style={[
                                    styles.experienceCard,
                                    questionnaire.experienceLevel === exp.value && styles.optionCardSelected,
                                ]}
                                onPress={() => setQuestionnaire(prev => ({ ...prev, experienceLevel: exp.value }))}
                            >
                                <Text style={[
                                    styles.experienceLabel,
                                    questionnaire.experienceLevel === exp.value && styles.optionLabelSelected,
                                ]}>
                                    {exp.label}
                                </Text>
                                <Text style={[
                                    styles.experienceDesc,
                                    questionnaire.experienceLevel === exp.value && styles.optionDescSelected,
                                ]}>
                                    {exp.desc}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                );

            case 2:
                return (
                    <View style={styles.frequencyContainer}>
                        {FREQUENCY.map(freq => (
                            <TouchableOpacity
                                key={freq}
                                style={[
                                    styles.frequencyButton,
                                    questionnaire.weeklyFrequency === freq && styles.frequencyButtonSelected,
                                ]}
                                onPress={() => setQuestionnaire(prev => ({ ...prev, weeklyFrequency: freq }))}
                            >
                                <Text style={[
                                    styles.frequencyNumber,
                                    questionnaire.weeklyFrequency === freq && styles.frequencyNumberSelected,
                                ]}>
                                    {freq}
                                </Text>
                                <Text style={[
                                    styles.frequencyLabel,
                                    questionnaire.weeklyFrequency === freq && styles.optionLabelSelected,
                                ]}>
                                    days/week
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                );

            case 3:
                return (
                    <View style={styles.optionsContainer}>
                        {EQUIPMENT.map(eq => (
                            <TouchableOpacity
                                key={eq.value}
                                style={[
                                    styles.optionCard,
                                    questionnaire.availableEquipment.includes(eq.value) && styles.optionCardSelected,
                                ]}
                                onPress={() => toggleEquipment(eq.value)}
                            >
                                <MaterialCommunityIcons
                                    name={eq.icon as any}
                                    size={28}
                                    color={questionnaire.availableEquipment.includes(eq.value) ? '#FFFFFF' : theme.primary}
                                />
                                <Text style={[
                                    styles.optionLabel,
                                    questionnaire.availableEquipment.includes(eq.value) && styles.optionLabelSelected,
                                ]}>
                                    {eq.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        <Text style={styles.multiSelectHint}>Select all that apply</Text>
                    </View>
                );

            case 4:
                return (
                    <View style={styles.frequencyContainer}>
                        {DURATIONS.map(dur => (
                            <TouchableOpacity
                                key={dur.value}
                                style={[
                                    styles.durationButton,
                                    questionnaire.sessionDuration === dur.value && styles.frequencyButtonSelected,
                                ]}
                                onPress={() => setQuestionnaire(prev => ({ ...prev, sessionDuration: dur.value }))}
                            >
                                <Text style={[
                                    styles.frequencyNumber,
                                    questionnaire.sessionDuration === dur.value && styles.frequencyNumberSelected,
                                ]}>
                                    {dur.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                );

            case 5:
                return (
                    <View style={styles.injuriesContainer}>
                        <TextInput
                            style={styles.injuriesInput}
                            placeholder="E.g., lower back pain, knee injury, shoulder issues..."
                            placeholderTextColor={theme.textTertiary}
                            value={questionnaire.injuries}
                            onChangeText={(text) => setQuestionnaire(prev => ({ ...prev, injuries: text }))}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />
                        <Text style={styles.injuriesHint}>
                            Leave empty if you have no injuries or limitations.
                        </Text>
                    </View>
                );

            default:
                return null;
        }
    };

    if (generating) {
        return (
            <View style={[styles.container, styles.loadingContainer]}>
                <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={styles.loadingText}>Generating your personalized plan...</Text>
                <Text style={styles.loadingSubtext}>This may take a few seconds</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => {
                    if (currentStep > 0) {
                        setCurrentStep(currentStep - 1);
                    } else {
                        safeBack(router);
                    }
                }}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>AI Workout Plan</Text>
                <View style={styles.stepIndicator}>
                    <Text style={styles.stepText}>{currentStep + 1}/{STEPS.length}</Text>
                </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${((currentStep + 1) / STEPS.length) * 100}%` }]} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Question */}
                <View style={styles.questionSection}>
                    <View style={styles.questionIconContainer}>
                        <MaterialCommunityIcons
                            name={STEPS[currentStep].icon as any}
                            size={32}
                            color={theme.primary}
                        />
                    </View>
                    <Text style={styles.questionTitle}>{STEPS[currentStep].title}</Text>
                </View>

                {/* Options */}
                {renderStep()}
            </ScrollView>

            {/* Bottom Button */}
            <View style={styles.bottomContainer}>
                <TouchableOpacity
                    style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled]}
                    disabled={!canProceed()}
                    onPress={() => {
                        if (currentStep < STEPS.length - 1) {
                            setCurrentStep(currentStep + 1);
                        } else {
                            handleGenerate();
                        }
                    }}
                >
                    <Text style={styles.nextButtonText}>
                        {currentStep === STEPS.length - 1 ? 'Generate Plan' : 'Continue'}
                    </Text>
                    <MaterialCommunityIcons
                        name={currentStep === STEPS.length - 1 ? 'robot' : 'arrow-right'}
                        size={20}
                        color="#FFFFFF"
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const createStyles = (theme: ThemeColors, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.text,
        marginTop: 24,
    },
    loadingSubtext: {
        fontSize: 14,
        color: theme.textSecondary,
        marginTop: 8,
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
    stepIndicator: {
        backgroundColor: theme.primaryLight,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    stepText: {
        fontSize: 13,
        fontWeight: '700',
        color: theme.primary,
    },
    progressBar: {
        height: 4,
        backgroundColor: theme.border,
    },
    progressFill: {
        height: 4,
        backgroundColor: theme.primary,
        borderRadius: 2,
    },
    scrollView: {
        flex: 1,
    },
    questionSection: {
        alignItems: 'center',
        paddingTop: 40,
        paddingBottom: 32,
        paddingHorizontal: 20,
    },
    questionIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: theme.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    questionTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: theme.text,
        textAlign: 'center',
    },
    optionsContainer: {
        paddingHorizontal: 20,
        gap: 12,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 20,
        gap: 16,
        borderWidth: 2,
        borderColor: theme.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    optionCardSelected: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
    },
    optionLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.text,
    },
    optionLabelSelected: {
        color: '#FFFFFF',
    },
    optionDescSelected: {
        color: 'rgba(255,255,255,0.7)',
    },
    experienceCard: {
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 20,
        borderWidth: 2,
        borderColor: theme.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    experienceLabel: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.text,
        marginBottom: 4,
    },
    experienceDesc: {
        fontSize: 14,
        color: theme.textSecondary,
    },
    multiSelectHint: {
        fontSize: 13,
        color: theme.textSecondary,
        textAlign: 'center',
        marginTop: 8,
    },
    frequencyContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 20,
        gap: 12,
        justifyContent: 'center',
    },
    frequencyButton: {
        width: 80,
        height: 80,
        borderRadius: 16,
        backgroundColor: theme.card,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: theme.border,
    },
    frequencyButtonSelected: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
    },
    frequencyNumber: {
        fontSize: 24,
        fontWeight: '700',
        color: theme.text,
    },
    frequencyNumberSelected: {
        color: '#FFFFFF',
    },
    frequencyLabel: {
        fontSize: 11,
        color: theme.textSecondary,
        marginTop: 2,
    },
    durationButton: {
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderRadius: 16,
        backgroundColor: theme.card,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: theme.border,
    },
    injuriesContainer: {
        paddingHorizontal: 20,
    },
    injuriesInput: {
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 20,
        fontSize: 16,
        color: theme.text,
        minHeight: 120,
        borderWidth: 1,
        borderColor: theme.border,
    },
    injuriesHint: {
        fontSize: 13,
        color: theme.textSecondary,
        marginTop: 12,
        textAlign: 'center',
    },
    bottomContainer: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        paddingTop: 16,
        backgroundColor: theme.background,
        borderTopWidth: 1,
        borderTopColor: theme.border,
    },
    nextButton: {
        backgroundColor: theme.primary,
        borderRadius: 16,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    nextButtonDisabled: {
        opacity: 0.4,
    },
    nextButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
