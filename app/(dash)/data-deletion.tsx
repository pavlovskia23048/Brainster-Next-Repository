import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { showAlert } from '@/utils/dialogs';
import React, { useMemo } from 'react';
import { Text } from '@/components/common/Text';
import { useRouter } from 'expo-router';
import { safeBack } from '@/utils/navigation';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

export default function DataDeletion() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

    const handleRequestDeletion = () => {
        showAlert(
            'Delete Account',
            'This will take you to the account deletion process. All your data will be permanently removed.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Continue',
                    style: 'destructive',
                    onPress: () => router.push('/(dash)/(tabs)/profile'),
                },
            ]
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router)}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Data Deletion</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    <View style={styles.warningCard}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={24} color={theme.error} />
                        <Text style={styles.warningText}>
                            Account deletion is permanent and cannot be undone. Please read this policy carefully.
                        </Text>
                    </View>

                    <Text style={styles.sectionTitle}>Data Deletion Policy</Text>
                    <Text style={styles.paragraph}>
                        This policy explains what happens when you delete your Fitness Challenge Hub account and how we handle your data.
                    </Text>

                    <Text style={styles.sectionTitle}>1. How to Delete Your Account</Text>
                    <Text style={styles.paragraph}>
                        You can delete your account through the app:
                    </Text>
                    <Text style={styles.bulletPoint}>1. Go to Profile tab</Text>
                    <Text style={styles.bulletPoint}>2. Scroll to the bottom</Text>
                    <Text style={styles.bulletPoint}>3. Tap "Delete Account"</Text>
                    <Text style={styles.bulletPoint}>4. Confirm your decision</Text>
                    <Text style={styles.paragraph}>
                        Alternatively, you can email us at privacy@fitnesschallengehub.com to request account deletion.
                    </Text>

                    <Text style={styles.sectionTitle}>2. What Gets Deleted</Text>
                    <Text style={styles.paragraph}>
                        When you delete your account, the following data will be permanently removed within 30 days:
                    </Text>
                    <Text style={styles.bulletPoint}>• Your account credentials and profile information</Text>
                    <Text style={styles.bulletPoint}>• All workout logs and exercise history</Text>
                    <Text style={styles.bulletPoint}>• Progress photos and body measurements</Text>
                    <Text style={styles.bulletPoint}>• Challenge participation and results</Text>
                    <Text style={styles.bulletPoint}>• Points, achievements, and level data</Text>
                    <Text style={styles.bulletPoint}>• Any other personal data associated with your account</Text>

                    <Text style={styles.sectionTitle}>3. Data Retention Period</Text>
                    <Text style={styles.paragraph}>
                        After you request account deletion:
                    </Text>
                    <Text style={styles.bulletPoint}>• Your account is immediately deactivated</Text>
                    <Text style={styles.bulletPoint}>• You can no longer access your account</Text>
                    <Text style={styles.bulletPoint}>• Your data will be deleted within 30 days</Text>
                    <Text style={styles.bulletPoint}>• We may retain certain data for legal compliance purposes</Text>

                    <Text style={styles.sectionTitle}>4. What We May Retain</Text>
                    <Text style={styles.paragraph}>
                        For legal, security, and business purposes, we may retain:
                    </Text>
                    <Text style={styles.bulletPoint}>• Transaction records (if applicable)</Text>
                    <Text style={styles.bulletPoint}>• Logs required for security and fraud prevention</Text>
                    <Text style={styles.bulletPoint}>• Information needed to comply with legal obligations</Text>
                    <Text style={styles.bulletPoint}>• Aggregated and anonymized data for analytics</Text>

                    <Text style={styles.sectionTitle}>5. Impact on Other Users</Text>
                    <Text style={styles.paragraph}>
                        When you delete your account:
                    </Text>
                    <Text style={styles.bulletPoint}>• Your display name may still appear in challenge history for other users</Text>
                    <Text style={styles.bulletPoint}>• Your profile will be removed from friend lists</Text>
                    <Text style={styles.bulletPoint}>• You will be removed from all active challenges</Text>

                    <Text style={styles.sectionTitle}>6. Canceling Deletion</Text>
                    <Text style={styles.paragraph}>
                        Once you confirm account deletion, it cannot be canceled. If you delete your account by mistake, please contact us immediately at privacy@fitnesschallengehub.com. We may be able to help within the 30-day deletion period.
                    </Text>

                    <Text style={styles.sectionTitle}>7. Creating a New Account</Text>
                    <Text style={styles.paragraph}>
                        After deleting your account:
                    </Text>
                    <Text style={styles.bulletPoint}>• You can create a new account at any time</Text>
                    <Text style={styles.bulletPoint}>• You may reuse your email address after 30 days</Text>
                    <Text style={styles.bulletPoint}>• Your previous data will not be recovered</Text>
                    <Text style={styles.bulletPoint}>• You will start fresh with no history</Text>

                    <Text style={styles.sectionTitle}>8. Third-Party Services</Text>
                    <Text style={styles.paragraph}>
                        We use Firebase (Google) for data storage. When you delete your account, we also request deletion of your data from Firebase servers. However, we recommend reviewing Google's data deletion policies as well.
                    </Text>

                    <Text style={styles.sectionTitle}>9. Questions or Concerns</Text>
                    <Text style={styles.paragraph}>
                        If you have any questions about data deletion or need assistance, please contact us:
                    </Text>
                    <Text style={styles.contactText}>privacy@fitnesschallengehub.com</Text>
                    <Text style={styles.paragraph}>
                        We typically respond within 48 hours.
                    </Text>

                    <TouchableOpacity style={styles.actionButton} onPress={handleRequestDeletion}>
                        <MaterialCommunityIcons name="delete-outline" size={20} color={theme.surface} />
                        <Text style={styles.actionButtonText}>Request Account Deletion</Text>
                    </TouchableOpacity>

                    <View style={styles.bottomPadding} />
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
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.text,
    },
    content: {
        padding: 20,
    },
    warningCard: {
        flexDirection: 'row',
        backgroundColor: isDark ? 'rgba(255, 107, 53, 0.15)' : '#FFF3E0',
        borderRadius: 12,
        padding: 16,
        gap: 12,
        marginBottom: 24,
        borderLeftWidth: 4,
        borderLeftColor: theme.error,
    },
    warningText: {
        flex: 1,
        fontSize: 14,
        color: theme.error,
        fontWeight: '600',
        lineHeight: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.text,
        marginTop: 24,
        marginBottom: 12,
    },
    paragraph: {
        fontSize: 15,
        color: theme.textSecondary,
        lineHeight: 24,
        marginBottom: 16,
    },
    bulletPoint: {
        fontSize: 15,
        color: theme.textSecondary,
        lineHeight: 24,
        marginBottom: 8,
        paddingLeft: 16,
    },
    contactText: {
        fontSize: 15,
        color: theme.primary,
        fontWeight: '600',
        marginTop: 8,
        marginBottom: 16,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.error,
        borderRadius: 12,
        padding: 16,
        gap: 8,
        marginTop: 24,
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.surface,
    },
    bottomPadding: {
        height: 100,
    },
});
