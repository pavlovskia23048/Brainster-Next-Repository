import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, Image, Switch, TextInput, Modal, ActivityIndicator } from 'react-native';
import { showAlert } from '@/utils/dialogs';
import React, { useState, useEffect, useMemo } from 'react';
import { Text } from '@/components/common/Text';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';
import Toast from 'react-native-toast-message';
import { reauthenticate, deleteUserAccount } from '@/services/accountService';

interface UserStats {
    totalWorkouts: number;
    points: number;
    level: number;
}

export default function Profile() {
    const router = useRouter();
    const { theme, themeMode, isDark, setThemeMode } = useTheme();
    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
    const [user, setUser] = useState(auth.currentUser);
    const [userStats, setUserStats] = useState<UserStats>({
        totalWorkouts: 0,
        points: 0,
        level: 1
    });
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [isPremium, setIsPremium] = useState(false);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                loadUserData(currentUser.uid);
            }
        });
        return () => unsubscribe();
    }, []);

    const loadUserData = async (userId: string) => {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                const data = userDoc.data();
                setUserStats(data.stats || { totalWorkouts: 0, points: 0, level: 1 });
                setIsPremium(data.subscriptionTier === 'premium');
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    };

    const handleSignOut = () => {
        showAlert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await signOut(auth);
                            router.replace('/(auth)/login');
                        } catch (error) {
                            console.error('Sign out error:', error);
                        }
                    },
                }
            ]
        );
    };

    const handleDeleteAccount = () => {
        showAlert(
            'Delete Account',
            'This action cannot be undone. All your data will be permanently deleted. You will need to enter your password to confirm.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Continue',
                    style: 'destructive',
                    onPress: () => {
                        setDeletePassword('');
                        setShowPasswordModal(true);
                    }
                }
            ]
        );
    };

    const handleConfirmDelete = async () => {
        if (!deletePassword.trim()) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter your password', position: 'top' });
            return;
        }

        setDeleting(true);
        try {
            await reauthenticate(deletePassword);
            const userId = auth.currentUser?.uid;
            if (!userId) throw new Error('No user found');

            await deleteUserAccount(userId);
            setShowPasswordModal(false);

            Toast.show({ type: 'success', text1: 'Account Deleted', text2: 'Your account and all data have been removed.', position: 'top' });
            router.replace('/(auth)/get-started');
        } catch (error: any) {
            const message = error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential'
                ? 'Incorrect password. Please try again.'
                : error?.message || 'Failed to delete account';
            Toast.show({ type: 'error', text1: 'Error', text2: message, position: 'top' });
        } finally {
            setDeleting(false);
        }
    };

    const handleChangePassword = () => {
        router.push('/(dash)/change-password');
    };

    const handleEditProfile = () => {
        router.push('/(dash)/edit-profile');
    };

    const openLink = (url: string) => {
        if (url === 'terms') {
            router.push('/(dash)/terms');
        } else if (url === 'privacy') {
            router.push('/(dash)/privacy');
        } else if (url === 'data-deletion') {
            router.push('/(dash)/data-deletion');
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Profile</Text>
                </View>

                {/* Profile Card */}
                <View style={styles.section}>
                    <View style={styles.profileCard}>
                        <View style={styles.avatarContainer}>
                            <View style={styles.avatar}>
                                {user?.photoURL ? (
                                    <Image
                                        source={{ uri: user.photoURL }}
                                        style={styles.avatarImage}
                                    />
                                ) : (
                                    <MaterialCommunityIcons name="account" size={48} color={theme.primary} />
                                )}
                            </View>
                        </View>
                        <View style={styles.nameRow}>
                            <Text style={styles.name}>{user?.displayName || 'User'}</Text>
                            {isPremium && (
                                <View style={styles.premiumBadge}>
                                    <MaterialCommunityIcons name="crown" size={14} color="#FFD700" />
                                    <Text style={styles.premiumBadgeText}>Premium</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.email}>{user?.email}</Text>
                    </View>
                </View>

                {/* Stats */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your Stats</Text>
                    <View style={styles.statsContainer}>
                        <View style={styles.statBox}>
                            <MaterialCommunityIcons name="dumbbell" size={24} color={theme.primary} />
                            <Text style={styles.statValue}>{userStats.totalWorkouts}</Text>
                            <Text style={styles.statLabel}>Workouts</Text>
                        </View>
                        <View style={styles.statBox}>
                            <MaterialCommunityIcons name="star" size={24} color={theme.primary} />
                            <Text style={styles.statValue}>{userStats.points}</Text>
                            <Text style={styles.statLabel}>Points</Text>
                        </View>
                        <View style={styles.statBox}>
                            <MaterialCommunityIcons name="trophy" size={24} color={theme.primary} />
                            <Text style={styles.statValue}>{userStats.level}</Text>
                            <Text style={styles.statLabel}>Level</Text>
                        </View>
                    </View>
                </View>

                {/* Appearance Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Appearance</Text>
                    <View style={styles.menuCard}>
                        <View style={styles.menuItem}>
                            <View style={styles.menuIconContainer}>
                                <MaterialCommunityIcons
                                    name={isDark ? "moon-waning-crescent" : "white-balance-sunny"}
                                    size={22}
                                    color={theme.primary}
                                />
                            </View>
                            <Text style={styles.menuLabel}>Dark Mode</Text>
                            <Switch
                                value={isDark}
                                onValueChange={(value) => setThemeMode(value ? 'dark' : 'light')}
                                trackColor={{ false: isDark ? theme.border : '#D1D5DB', true: theme.primary }}
                                thumbColor={'#FFFFFF'}
                                ios_backgroundColor={isDark ? theme.border : '#D1D5DB'}
                            />
                        </View>
                    </View>
                </View>

                {/* Account Settings */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <View style={styles.menuCard}>
                        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(dash)/ai-plans')}>
                            <View style={styles.menuIconContainer}>
                                <MaterialCommunityIcons name="robot-outline" size={22} color={theme.primary} />
                            </View>
                            <Text style={styles.menuLabel}>AI Workout Plans</Text>
                            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textTertiary} />
                        </TouchableOpacity>
                        <View style={styles.menuDivider} />
                        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(dash)/subscription')}>
                            <View style={styles.menuIconContainer}>
                                <MaterialCommunityIcons name="crown-outline" size={22} color={theme.primary} />
                            </View>
                            <Text style={styles.menuLabel}>Subscription</Text>
                            {isPremium && (
                                <View style={styles.premiumMenuBadge}>
                                    <Text style={styles.premiumMenuBadgeText}>Active</Text>
                                </View>
                            )}
                            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textTertiary} />
                        </TouchableOpacity>
                        <View style={styles.menuDivider} />
                        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(dash)/friends')}>
                            <View style={styles.menuIconContainer}>
                                <MaterialCommunityIcons name="account-group-outline" size={22} color={theme.primary} />
                            </View>
                            <Text style={styles.menuLabel}>Friends</Text>
                            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textTertiary} />
                        </TouchableOpacity>
                        <View style={styles.menuDivider} />
                        <TouchableOpacity style={styles.menuItem} onPress={handleEditProfile}>
                            <View style={styles.menuIconContainer}>
                                <MaterialCommunityIcons name="account-edit-outline" size={22} color={theme.primary} />
                            </View>
                            <Text style={styles.menuLabel}>Edit Profile</Text>
                            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textTertiary} />
                        </TouchableOpacity>
                        <View style={styles.menuDivider} />
                        <TouchableOpacity style={styles.menuItem} onPress={handleChangePassword}>
                            <View style={styles.menuIconContainer}>
                                <MaterialCommunityIcons name="lock-outline" size={22} color={theme.primary} />
                            </View>
                            <Text style={styles.menuLabel}>Change Password</Text>
                            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textTertiary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Sign Out */}
                <View style={styles.section}>
                    <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                        <MaterialCommunityIcons name="logout" size={20} color="#FFFFFF" />
                        <Text style={styles.signOutText}>Sign Out</Text>
                    </TouchableOpacity>
                </View>

                {/* Delete Account */}
                <View style={styles.section}>
                    <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
                        <Text style={styles.deleteText}>Delete Account</Text>
                    </TouchableOpacity>
                </View>

                {/* Legal Links */}
                <View style={[styles.section, { marginBottom: 100 }]}>
                    <View style={styles.legalContainer}>
                        <TouchableOpacity onPress={() => openLink('terms')}>
                            <Text style={styles.legalLink}>Terms & Conditions</Text>
                        </TouchableOpacity>
                        <Text style={styles.legalDivider}>•</Text>
                        <TouchableOpacity onPress={() => openLink('privacy')}>
                            <Text style={styles.legalLink}>Privacy Policy</Text>
                        </TouchableOpacity>
                        <Text style={styles.legalDivider}>•</Text>
                        <TouchableOpacity onPress={() => openLink('data-deletion')}>
                            <Text style={styles.legalLink}>Data Deletion</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.versionText}>Version 1.0.0</Text>
                </View>
            </ScrollView>

            {/* Password Confirmation Modal for Account Deletion */}
            <Modal
                visible={showPasswordModal}
                transparent
                animationType="fade"
                onRequestClose={() => !deleting && setShowPasswordModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Confirm Deletion</Text>
                        <Text style={styles.modalSubtitle}>
                            Enter your password to permanently delete your account and all data.
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Enter your password"
                            placeholderTextColor={theme.textTertiary}
                            secureTextEntry
                            value={deletePassword}
                            onChangeText={setDeletePassword}
                            editable={!deleting}
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => setShowPasswordModal(false)}
                                disabled={deleting}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalDeleteButton}
                                onPress={handleConfirmDelete}
                                disabled={deleting}
                            >
                                {deleting ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.modalDeleteText}>Delete Account</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 24,
        backgroundColor: theme.surface,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '700',
        color: theme.text,
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.text,
        marginBottom: 12,
    },
    profileCard: {
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: isDark ? 1 : 0,
        borderColor: theme.border,
    },
    avatarContainer: {
        marginBottom: 16,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: theme.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    name: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.text,
    },
    premiumBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255, 215, 0, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    premiumBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#D4A017',
    },
    premiumMenuBadge: {
        backgroundColor: theme.success + '20',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginRight: 4,
    },
    premiumMenuBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: theme.success,
    },
    email: {
        fontSize: 14,
        color: theme.textTertiary,
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    statBox: {
        flex: 1,
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: isDark ? 1 : 0,
        borderColor: theme.border,
    },
    statValue: {
        fontSize: 22,
        fontWeight: '800',
        color: theme.text,
        marginTop: 8,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: theme.textSecondary,
        fontWeight: '500',
    },
    menuCard: {
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
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    menuIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    menuLabel: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: theme.text,
    },
    menuDivider: {
        height: 1,
        backgroundColor: theme.border,
        marginLeft: 68,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.primary,
        borderRadius: 12,
        padding: 16,
        gap: 8,
    },
    signOutText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    deleteButton: {
        alignItems: 'center',
        padding: 12,
    },
    deleteText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.textTertiary,
    },
    legalContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 8,
    },
    legalLink: {
        fontSize: 12,
        color: theme.textTertiary,
        fontWeight: '500',
    },
    legalDivider: {
        fontSize: 12,
        color: theme.divider,
        marginHorizontal: 8,
    },
    versionText: {
        fontSize: 12,
        color: theme.divider,
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: theme.card,
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.error,
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        color: theme.textSecondary,
        lineHeight: 20,
        marginBottom: 20,
    },
    modalInput: {
        backgroundColor: theme.surface,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: theme.text,
        borderWidth: 1,
        borderColor: theme.border,
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalCancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: theme.surface,
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.text,
    },
    modalDeleteButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: theme.error,
        alignItems: 'center',
    },
    modalDeleteText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});