import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import React, { useMemo } from 'react';
import { Text } from '@/components/common/Text';
import { useRouter } from 'expo-router';
import { safeBack } from '@/utils/navigation';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

export default function PrivacyPolicy() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router)}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Privacy Policy</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    <Text style={styles.lastUpdated}>Last updated: January 18, 2026</Text>

                    <Text style={styles.paragraph}>
                        At Fitness Challenge Hub, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application.
                    </Text>

                    <Text style={styles.sectionTitle}>1. Information We Collect</Text>

                    <Text style={styles.subSectionTitle}>Personal Information</Text>
                    <Text style={styles.paragraph}>
                        When you create an account, we collect:
                    </Text>
                    <Text style={styles.bulletPoint}>• Email address</Text>
                    <Text style={styles.bulletPoint}>• Display name</Text>
                    <Text style={styles.bulletPoint}>• Profile photo (optional)</Text>

                    <Text style={styles.subSectionTitle}>Fitness Data</Text>
                    <Text style={styles.paragraph}>
                        We collect information you provide about your fitness activities:
                    </Text>
                    <Text style={styles.bulletPoint}>• Workout logs and exercise history</Text>
                    <Text style={styles.bulletPoint}>• Progress photos</Text>
                    <Text style={styles.bulletPoint}>• Body measurements</Text>
                    <Text style={styles.bulletPoint}>• Challenge participation and results</Text>
                    <Text style={styles.bulletPoint}>• Points and achievement data</Text>

                    <Text style={styles.subSectionTitle}>Automatically Collected Information</Text>
                    <Text style={styles.paragraph}>
                        When you use the app, we may automatically collect:
                    </Text>
                    <Text style={styles.bulletPoint}>• Device information (model, OS version)</Text>
                    <Text style={styles.bulletPoint}>• App usage data and analytics</Text>
                    <Text style={styles.bulletPoint}>• Crash reports and error logs</Text>

                    <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
                    <Text style={styles.paragraph}>
                        We use your information to:
                    </Text>
                    <Text style={styles.bulletPoint}>• Provide and maintain the app functionality</Text>
                    <Text style={styles.bulletPoint}>• Track your fitness progress and achievements</Text>
                    <Text style={styles.bulletPoint}>• Enable challenges and social features</Text>
                    <Text style={styles.bulletPoint}>• Send important notifications and updates</Text>
                    <Text style={styles.bulletPoint}>• Improve our services and user experience</Text>
                    <Text style={styles.bulletPoint}>• Respond to your support requests</Text>

                    <Text style={styles.sectionTitle}>3. Information Sharing</Text>
                    <Text style={styles.paragraph}>
                        We do not sell your personal information. We may share your information only in the following circumstances:
                    </Text>
                    <Text style={styles.bulletPoint}>• With other users: Your display name and challenge participation may be visible to other users</Text>
                    <Text style={styles.bulletPoint}>• With service providers: We use Firebase and other services to operate our app</Text>
                    <Text style={styles.bulletPoint}>• For legal reasons: When required by law or to protect our rights</Text>

                    <Text style={styles.sectionTitle}>4. Data Security</Text>
                    <Text style={styles.paragraph}>
                        We implement appropriate technical and organizational measures to protect your personal information, including:
                    </Text>
                    <Text style={styles.bulletPoint}>• Encrypted data transmission (HTTPS/TLS)</Text>
                    <Text style={styles.bulletPoint}>• Secure authentication with Firebase</Text>
                    <Text style={styles.bulletPoint}>• Regular security assessments</Text>
                    <Text style={styles.bulletPoint}>• Access controls and monitoring</Text>

                    <Text style={styles.sectionTitle}>5. Your Privacy Rights</Text>
                    <Text style={styles.paragraph}>
                        You have the right to:
                    </Text>
                    <Text style={styles.bulletPoint}>• Access your personal data</Text>
                    <Text style={styles.bulletPoint}>• Update or correct your information</Text>
                    <Text style={styles.bulletPoint}>• Delete your account and data</Text>
                    <Text style={styles.bulletPoint}>• Opt-out of promotional communications</Text>
                    <Text style={styles.bulletPoint}>• Request a copy of your data</Text>

                    <Text style={styles.sectionTitle}>6. Data Retention</Text>
                    <Text style={styles.paragraph}>
                        We retain your information for as long as your account is active or as needed to provide services. When you delete your account, we will delete your personal information within 30 days, except where we are required to retain it for legal purposes.
                    </Text>

                    <Text style={styles.sectionTitle}>7. Children's Privacy</Text>
                    <Text style={styles.paragraph}>
                        Our service is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child, please contact us immediately.
                    </Text>

                    <Text style={styles.sectionTitle}>8. Third-Party Services</Text>
                    <Text style={styles.paragraph}>
                        We use the following third-party services:
                    </Text>
                    <Text style={styles.bulletPoint}>• Firebase (Google) - Authentication and database</Text>
                    <Text style={styles.bulletPoint}>• Firebase Storage - Photo and file storage</Text>
                    <Text style={styles.bulletPoint}>• Firebase Analytics - App usage analytics</Text>

                    <Text style={styles.sectionTitle}>9. Changes to This Policy</Text>
                    <Text style={styles.paragraph}>
                        We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy in the app and updating the "Last updated" date.
                    </Text>

                    <Text style={styles.sectionTitle}>10. Contact Us</Text>
                    <Text style={styles.paragraph}>
                        If you have any questions or concerns about this Privacy Policy, please contact us at:
                    </Text>
                    <Text style={styles.contactText}>privacy@fitnesschallengehub.com</Text>

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
    lastUpdated: {
        fontSize: 13,
        color: theme.textSecondary,
        marginBottom: 24,
        fontStyle: 'italic',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.text,
        marginTop: 24,
        marginBottom: 12,
    },
    subSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.textSecondary,
        marginTop: 16,
        marginBottom: 8,
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
    },
    bottomPadding: {
        height: 100,
    },
});
