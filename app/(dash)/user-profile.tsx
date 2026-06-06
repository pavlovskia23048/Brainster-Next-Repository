import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, Modal, TextInput, Image } from 'react-native';
import React, { useState, useEffect, useMemo } from 'react';
import { Text } from '@/components/common/Text';
import { auth, db } from '@/config/firebase';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '@/utils/navigation';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, getDoc, collection, query, where, getDocs, addDoc, deleteDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';
import { Calendar } from 'react-native-calendars';
import { sendWorkoutInvitation } from '@/utils/notifications';

interface UserStats {
    totalWorkouts: number;
    points: number;
    level: number;
    streak?: number;
}

interface UserData {
    uid: string;
    displayName: string;
    email: string;
    photoURL?: string;
    stats: UserStats;
}

interface WorkoutLog {
    id: string;
    userId: string;
    workoutName: string;
    date: Date;
    duration: number;
    exercises: any[];
}

export default function UserProfile() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const { userId } = useLocalSearchParams();
    const [userData, setUserData] = useState<UserData | null>(null);
    const [isFriend, setIsFriend] = useState(false);
    const [friendshipId, setFriendshipId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
    const [markedDates, setMarkedDates] = useState<any>({});
    const [streak, setStreak] = useState(0);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteMessage, setInviteMessage] = useState('');
    const [sendingInvite, setSendingInvite] = useState(false);
    const currentUserId = auth.currentUser?.uid;

    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

    useEffect(() => {
        if (userId) {
            loadUserData(userId as string);
            checkFriendship(userId as string);
            loadWorkouts(userId as string);
        }
    }, [userId]);

    const loadUserData = async (uid: string) => {
        try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
                setUserData({
                    uid: userDoc.id,
                    ...userDoc.data()
                } as UserData);
            }
        } catch (error) {
            console.error('Error loading user:', error);
        } finally {
            setLoading(false);
        }
    };

    const checkFriendship = async (uid: string) => {
        if (!currentUserId) return;

        try {
            // Check if friendship exists
            const friendshipsRef = collection(db, 'friendships');
            const q = query(
                friendshipsRef,
                where('users', 'array-contains', currentUserId)
            );
            const snapshot = await getDocs(q);

            const friendship = snapshot.docs.find(doc => {
                const data = doc.data();
                return data.users.includes(uid);
            });

            if (friendship) {
                setIsFriend(true);
                setFriendshipId(friendship.id);
            }
        } catch (error) {
            console.error('Error checking friendship:', error);
        }
    };

    const handleAddFriend = async () => {
        if (!currentUserId || !userId) return;

        try {
            const friendshipData = {
                users: [currentUserId, userId],
                createdAt: serverTimestamp(),
                initiatedBy: currentUserId,
            };

            const docRef = await addDoc(collection(db, 'friendships'), friendshipData);
            setIsFriend(true);
            setFriendshipId(docRef.id);

            Toast.show({
                type: 'success',
                text1: 'Friend Added!',
                text2: `You are now friends with ${userData?.displayName}`,
                position: 'top',
            });
        } catch (error) {
            console.error('Error adding friend:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to add friend',
                position: 'top',
            });
        }
    };

    const handleRemoveFriend = async () => {
        if (!friendshipId) return;

        try {
            await deleteDoc(doc(db, 'friendships', friendshipId));
            setIsFriend(false);
            setFriendshipId(null);

            Toast.show({
                type: 'success',
                text1: 'Friend Removed',
                text2: `You are no longer friends with ${userData?.displayName}`,
                position: 'top',
            });
        } catch (error) {
            console.error('Error removing friend:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to remove friend',
                position: 'top',
            });
        }
    };

    const handleSendInvite = async () => {
        if (!currentUserId || !userId || !userData) return;

        try {
            setSendingInvite(true);

            // Get current user data
            const currentUserDoc = await getDoc(doc(db, 'users', currentUserId));
            const currentUserName = currentUserDoc.data()?.displayName || 'Someone';

            // Save invitation to Firestore
            const invitationRef = await addDoc(collection(db, 'workoutInvitations'), {
                fromUserId: currentUserId,
                fromUserName: currentUserName,
                toUserId: userId,
                toUserName: userData.displayName,
                message: inviteMessage.trim() || 'Let\'s crush this workout together!',
                createdAt: serverTimestamp(),
                status: 'pending',
            });

            // Send notification with invitation ID
            await sendWorkoutInvitation(
                userId as string,
                currentUserName,
                inviteMessage.trim() || 'Let\'s crush this workout together!',
                invitationRef.id
            );

            Toast.show({
                type: 'success',
                text1: 'Invitation Sent!',
                text2: `${userData.displayName} has been invited to workout with you`,
                position: 'top',
            });

            setShowInviteModal(false);
            setInviteMessage('');
        } catch (error) {
            console.error('Error sending invitation:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to send invitation',
                position: 'top',
            });
        } finally {
            setSendingInvite(false);
        }
    };

    const loadWorkouts = async (uid: string) => {
        try {
            const workoutsRef = collection(db, 'workoutLogs');
            const q = query(
                workoutsRef,
                where('userId', '==', uid),
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
        }
    };

    const markCalendarDates = (logs: WorkoutLog[]) => {
        const marked: any = {};
        logs.forEach(log => {
            const dateStr = log.date.toISOString().split('T')[0];
            marked[dateStr] = {
                marked: true,
                dotColor: theme.primary,
            };
        });
        setMarkedDates(marked);
    };

    const calculateStreak = (logs: WorkoutLog[]) => {
        if (logs.length === 0) {
            setStreak(0);
            return;
        }

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

    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </View>
        );
    }

    if (!userData) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>User not found</Text>
                </View>
            </View>
        );
    }

    const isOwnProfile = currentUserId === userId;

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router)}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Profile Card */}
                <View style={styles.section}>
                    <View style={styles.profileCard}>
                        <View style={styles.avatarContainer}>
                            <View style={styles.avatar}>
                                {userData.photoURL ? (
                                    <Image
                                        source={{ uri: userData.photoURL }}
                                        style={styles.avatarImage}
                                    />
                                ) : (
                                    <MaterialCommunityIcons name="account" size={48} color={theme.primary} />
                                )}
                            </View>
                        </View>
                        <Text style={styles.name}>{userData.displayName}</Text>
                        <Text style={styles.email}>{userData.email}</Text>

                        {!isOwnProfile && (
                            <View style={styles.actionButtonsContainer}>
                                <TouchableOpacity
                                    style={[styles.actionButton, isFriend && styles.actionButtonSecondary]}
                                    onPress={isFriend ? handleRemoveFriend : handleAddFriend}
                                >
                                    <MaterialCommunityIcons
                                        name={isFriend ? "account-check" : "account-plus"}
                                        size={20}
                                        color={isFriend ? "#1B316C" : "#FFFFFF"}
                                    />
                                    <Text style={[styles.actionButtonText, isFriend && styles.actionButtonTextSecondary]}>
                                        {isFriend ? 'Friends' : 'Add Friend'}
                                    </Text>
                                </TouchableOpacity>

                                {isFriend && (
                                    <TouchableOpacity
                                        style={styles.inviteButton}
                                        onPress={() => setShowInviteModal(true)}
                                    >
                                        <MaterialCommunityIcons name="dumbbell" size={20} color="#FFFFFF" />
                                        <Text style={styles.actionButtonText}>Invite to Workout</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>
                </View>

                {/* Stats */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Stats</Text>
                    <View style={styles.statsContainer}>
                        <View style={styles.statBox}>
                            <MaterialCommunityIcons name="dumbbell" size={24} color={theme.primary} />
                            <Text style={styles.statValue}>{userData.stats.totalWorkouts}</Text>
                            <Text style={styles.statLabel}>Workouts</Text>
                        </View>
                        <View style={styles.statBox}>
                            <MaterialCommunityIcons name="star" size={24} color={theme.primary} />
                            <Text style={styles.statValue}>{userData.stats.points}</Text>
                            <Text style={styles.statLabel}>Points</Text>
                        </View>
                        <View style={styles.statBox}>
                            <MaterialCommunityIcons name="fire" size={24} color="#FF6B35" />
                            <Text style={styles.statValue}>{streak}</Text>
                            <Text style={styles.statLabel}>Streak</Text>
                        </View>
                    </View>
                </View>

                {/* Workout Calendar */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Workout Calendar</Text>
                    <View style={styles.calendarCard}>
                        <Calendar
                            key={isDark ? 'calendar-dark' : 'calendar-light'}
                            markedDates={markedDates}
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

                {/* Recent Workouts */}
                <View style={[styles.section, { marginBottom: 100 }]}>
                    <Text style={styles.sectionTitle}>Recent Workouts</Text>
                    {workoutLogs.length === 0 ? (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="weight-lifter" size={48} color={theme.textTertiary} />
                            <Text style={styles.emptyText}>No workouts yet</Text>
                        </View>
                    ) : (
                        <View style={styles.workoutsList}>
                            {workoutLogs.slice(0, 5).map(workout => (
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
                                            <MaterialCommunityIcons name="calendar" size={14} color={theme.textSecondary} />
                                            <Text style={styles.workoutMetaText}>
                                                {workout.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </Text>
                                            <MaterialCommunityIcons name="clock-outline" size={14} color={theme.textSecondary} style={{ marginLeft: 12 }} />
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

            {/* Invite to Workout Modal */}
            <Modal
                visible={showInviteModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowInviteModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Invite to Workout</Text>
                            <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                                <MaterialCommunityIcons name="close" size={24} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            <View style={styles.inviteToContainer}>
                                <View style={styles.inviteAvatar}>
                                    <MaterialCommunityIcons name="account" size={32} color={theme.primary} />
                                </View>
                                <View>
                                    <Text style={styles.inviteToLabel}>Inviting</Text>
                                    <Text style={styles.inviteToName}>{userData?.displayName}</Text>
                                </View>
                            </View>

                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Message (Optional)</Text>
                                <TextInput
                                    style={styles.messageInput}
                                    placeholder="Let's crush this workout together!"
                                    placeholderTextColor={theme.textTertiary}
                                    value={inviteMessage}
                                    onChangeText={setInviteMessage}
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                />
                            </View>

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => {
                                        setShowInviteModal(false);
                                        setInviteMessage('');
                                    }}
                                >
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.sendButton, sendingInvite && styles.sendButtonDisabled]}
                                    onPress={handleSendInvite}
                                    disabled={sendingInvite}
                                >
                                    <MaterialCommunityIcons
                                        name={sendingInvite ? "loading" : "send"}
                                        size={20}
                                        color="#FFFFFF"
                                    />
                                    <Text style={styles.sendButtonText}>
                                        {sendingInvite ? 'Sending...' : 'Send Invite'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 16,
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
        marginBottom: 12,
    },
    profileCard: {
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
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
    name: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.text,
        marginBottom: 4,
    },
    email: {
        fontSize: 14,
        color: theme.textSecondary,
        marginBottom: 20,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.primary,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 24,
        gap: 8,
        minWidth: 150,
    },
    actionButtonSecondary: {
        backgroundColor: theme.primaryLight,
    },
    actionButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    actionButtonTextSecondary: {
        color: theme.primary,
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    statBox: {
        flex: 1,
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
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
    calendarCard: {
        backgroundColor: theme.card,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    workoutsList: {
        gap: 12,
    },
    workoutCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
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
        color: theme.textSecondary,
        marginLeft: 4,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 48,
        backgroundColor: theme.card,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    emptyText: {
        fontSize: 16,
        color: theme.textSecondary,
        marginTop: 12,
    },
    actionButtonsContainer: {
        width: '100%',
        gap: 12,
        marginTop: 8,
    },
    inviteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.accent,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 24,
        gap: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: theme.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.text,
    },
    modalBody: {
        paddingHorizontal: 24,
        paddingTop: 24,
    },
    inviteToContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.background,
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        gap: 12,
    },
    inviteAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: theme.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    inviteToLabel: {
        fontSize: 12,
        color: theme.textSecondary,
        marginBottom: 2,
    },
    inviteToName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.text,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.text,
        marginBottom: 8,
    },
    messageInput: {
        backgroundColor: theme.background,
        borderRadius: 12,
        padding: 16,
        fontSize: 15,
        color: theme.text,
        minHeight: 100,
        borderWidth: 1,
        borderColor: theme.border,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
    },
    cancelButton: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.textSecondary,
    },
    sendButton: {
        flex: 1,
        flexDirection: 'row',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.primary,
        gap: 8,
    },
    sendButtonDisabled: {
        opacity: 0.6,
    },
    sendButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
