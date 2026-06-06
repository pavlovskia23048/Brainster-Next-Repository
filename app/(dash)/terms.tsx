import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import React, { useMemo } from 'react';
import { Text } from '@/components/common/Text';
import { useRouter } from 'expo-router';
import { safeBack } from '@/utils/navigation';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

export default function TermsAndConditions() {
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
                <Text style={styles.headerTitle}>Terms & Conditions</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    <Text style={styles.lastUpdated}>Last updated: January 18, 2026</Text>

                    <Text style={styles.paragraph}>
                        Welcome to Fitness Challenge Hub. By accessing or using our application, you agree to be bound by these Terms and Conditions.
                    </Text>

                    <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
                    <Text style={styles.paragraph}>
                        By creating an account and using Fitness Challenge Hub, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you may not use our service.
                    </Text>

                    <Text style={styles.sectionTitle}>2. User Account</Text>
                    <Text style={styles.paragraph}>
                        You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to:
                    </Text>
                    <Text style={styles.bulletPoint}>• Provide accurate and complete information</Text>
                    <Text style={styles.bulletPoint}>• Keep your password secure and confidential</Text>
                    <Text style={styles.bulletPoint}>• Notify us immediately of any unauthorized access</Text>
                    <Text style={styles.bulletPoint}>• Not share your account with others</Text>

                    <Text style={styles.sectionTitle}>3. User Content</Text>
                    <Text style={styles.paragraph}>
                        You retain ownership of any content you post, including workout logs, progress photos, and challenge data. By posting content, you grant Fitness Challenge Hub a worldwide, non-exclusive license to use, store, and display your content as necessary to provide our services.
                    </Text>

                    <Text style={styles.sectionTitle}>4. Acceptable Use</Text>
                    <Text style={styles.paragraph}>
                        You agree not to:
                    </Text>
                    <Text style={styles.bulletPoint}>• Use the service for any illegal purpose</Text>
                    <Text style={styles.bulletPoint}>• Harass, abuse, or harm other users</Text>
                    <Text style={styles.bulletPoint}>• Post inappropriate or offensive content</Text>
                    <Text style={styles.bulletPoint}>• Attempt to gain unauthorized access to our systems</Text>
                    <Text style={styles.bulletPoint}>• Interfere with the proper functioning of the service</Text>

                    <Text style={styles.sectionTitle}>5. Health and Safety</Text>
                    <Text style={styles.paragraph}>
                        Fitness Challenge Hub is not a substitute for professional medical advice. Always consult with a healthcare provider before starting any new fitness program. We are not responsible for any injuries or health issues that may occur while using our service.
                    </Text>

                    <Text style={styles.sectionTitle}>6. Limitation of Liability</Text>
                    <Text style={styles.paragraph}>
                        Fitness Challenge Hub is provided "as is" without warranties of any kind. We shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.
                    </Text>

                    <Text style={styles.sectionTitle}>7. Termination</Text>
                    <Text style={styles.paragraph}>
                        We reserve the right to suspend or terminate your account at any time for violations of these terms or for any other reason at our sole discretion. You may also delete your account at any time through the app settings.
                    </Text>

                    <Text style={styles.sectionTitle}>8. Changes to Terms</Text>
                    <Text style={styles.paragraph}>
                        We may modify these Terms and Conditions at any time. We will notify you of any material changes through the app or via email. Your continued use of the service after such modifications constitutes acceptance of the updated terms.
                    </Text>

                    <Text style={styles.sectionTitle}>9. Contact Us</Text>
                    <Text style={styles.paragraph}>
                        If you have any questions about these Terms and Conditions, please contact us at:
                    </Text>
                    <Text style={styles.contactText}>support@fitnesschallengehub.com</Text>

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
