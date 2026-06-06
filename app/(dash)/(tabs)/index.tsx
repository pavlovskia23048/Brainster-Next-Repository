import { StyleSheet, View, ScrollView, TouchableOpacity, Dimensions, StatusBar } from 'react-native'
import React, { useState, useEffect, useMemo } from 'react'
import MainContainer from '@/components/common/MainContainer'
import { Text } from '@/components/common/Text'
import { auth, db } from '@/config/firebase'
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTheme } from '@/contexts/ThemeContext'
import { ThemeColors } from '@/constants/theme'

const { width } = Dimensions.get('window');

interface UserStats {
    totalWorkouts: number;
    points: number;
    level: number;
}

interface FriendActivity {
    id: string;
    userId: string;
    userName: string;
    workoutName: string;
    date: Date;
    duration: number;
    exerciseCount: number;
}

export default function Index() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
    const [user, setUser] = useState(auth.currentUser);
    const [userStats, setUserStats] = useState<UserStats>({
        totalWorkouts: 0,
        points: 0,
        level: 1
    });
    const [loading, setLoading] = useState(true);
    const [friendActivities, setFriendActivities] = useState<FriendActivity[]>([]);
    const [unreadNotifications, setUnreadNotifications] = useState(0);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                loadUserData(currentUser.uid);
                loadFriendActivities(currentUser.uid);
                loadUnreadNotifications(currentUser.uid);
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
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadFriendActivities = async (userId: string) => {
        try {
            // Get user's friends
            const friendshipsRef = collection(db, 'friendships');
            const q = query(friendshipsRef, where('users', 'array-contains', userId));
            const friendshipsSnapshot = await getDocs(q);

            // Use Set to prevent duplicate friend IDs
            const friendIdsSet = new Set<string>();
            friendshipsSnapshot.docs.forEach(doc => {
                const users = doc.data().users;
                const friendId = users.find((id: string) => id !== userId);
                if (friendId) friendIdsSet.add(friendId);
            });

            const friendIds = Array.from(friendIdsSet);

            if (friendIds.length === 0) {
                setFriendActivities([]);
                return;
            }

            // Get recent workouts from friends (last 10 workouts total)
            const workoutsRef = collection(db, 'workoutLogs');
            const workoutsQuery = query(
                workoutsRef,
                where('userId', 'in', friendIds.slice(0, 10)), // Firestore 'in' limited to 10
                orderBy('date', 'desc'),
                limit(10)
            );
            const workoutsSnapshot = await getDocs(workoutsQuery);

            // Get friend names
            const friendsDataPromises = friendIds.map(id => getDoc(doc(db, 'users', id)));
            const friendsData = await Promise.all(friendsDataPromises);
            const friendsMap = new Map();
            friendsData.forEach(doc => {
                if (doc.exists()) {
                    friendsMap.set(doc.id, doc.data().displayName || 'Unknown');
                }
            });

            // Map workouts with friend names
            const activities: FriendActivity[] = workoutsSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    userId: data.userId,
                    userName: friendsMap.get(data.userId) || 'Unknown',
                    workoutName: data.workoutName,
                    date: data.date.toDate(),
                    duration: data.duration,
                    exerciseCount: data.exercises?.length || 0,
                };
            });

            setFriendActivities(activities);
        } catch (error) {
            console.error('Error loading friend activities:', error);
        }
    };

    const loadUnreadNotifications = async (userId: string) => {
        try {
            const notificationsRef = collection(db, 'notifications');
            const q = query(
                notificationsRef,
                where('userId', '==', userId),
                where('read', '==', false)
            );
            const snapshot = await getDocs(q);
            setUnreadNotifications(snapshot.size);
        } catch (error) {
            console.error('Error loading unread notifications:', error);
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const getTimeAgo = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerTop}>
                        <View>
                            <Text style={styles.greeting}>{getGreeting()}</Text>
                            <Text style={styles.userName}>{user?.displayName || 'User'}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.notificationButton}
                            onPress={() => router.push('/(dash)/notifications')}
                        >
                            <MaterialCommunityIcons name="bell-outline" size={24} color={theme.text} />
                            {unreadNotifications > 0 && (
                                <View style={styles.notificationBadge}>
                                    <Text style={styles.badgeText}>
                                        {unreadNotifications > 9 ? '9+' : unreadNotifications}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Today's Summary Card */}
                <View style={styles.section}>
                    <View style={styles.todayMainCard}>
                        <View style={styles.todayHeader}>
                            <View>
                                <Text style={styles.todayLabel}>Today's Goal</Text>
                                <Text style={styles.todayDate}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
                            </View>
                            <View style={styles.streakBadge}>
                                <MaterialCommunityIcons name="fire" size={16} color={theme.accent} />
                                <Text style={styles.streakText}>0 days</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.startWorkoutButton}
                            onPress={() => router.push('/(dash)/(tabs)/workouts')}
                        >
                            <View style={styles.startButtonContent}>
                                <View style={styles.playIconContainer}>
                                    <MaterialCommunityIcons name="play" size={24} color="#FFFFFF" />
                                </View>
                                <View>
                                    <Text style={styles.startButtonText}>Start Workout</Text>
                                    <Text style={styles.startButtonSubtext}>Get moving today</Text>
                                </View>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={24} color={theme.textTertiary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Stats Overview */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Overview</Text>
                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <View style={styles.statCardHeader}>
                                <MaterialCommunityIcons name="dumbbell" size={24} color={theme.primary} />
                                <Text style={styles.statValue}>{userStats.totalWorkouts}</Text>
                            </View>
                            <Text style={styles.statLabel}>Total Workouts</Text>
                            <View style={styles.statTrend}>
                                <MaterialCommunityIcons name="trending-up" size={14} color={theme.success} />
                                <Text style={styles.statTrendText}>This week</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.statCard}
                            onPress={() => router.push('/(dash)/levels')}
                            activeOpacity={0.7}
                        >
                            <View style={styles.statCardHeader}>
                                <MaterialCommunityIcons name="star" size={24} color={theme.primary} />
                                <Text style={styles.statValue}>{userStats.points}</Text>
                            </View>
                            <Text style={styles.statLabel}>Total Points</Text>
                            <View style={styles.statTrend}>
                                <MaterialCommunityIcons name="trophy" size={14} color={theme.warning} />
                                <Text style={styles.statTrendText}>Level {userStats.level}</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.actionsContainer}>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => router.push('/(dash)/ai-plans')}
                        >
                            <View style={[styles.actionIconBg, { backgroundColor: theme.accent + '20' }]}>
                                <MaterialCommunityIcons name="robot-outline" size={20} color={theme.accent} />
                            </View>
                            <Text style={styles.actionLabel}>AI Plans</Text>
                            <MaterialCommunityIcons name="chevron-right" size={18} color={theme.textTertiary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => router.push('/(dash)/(tabs)/challenges')}
                        >
                            <View style={styles.actionIconBg}>
                                <MaterialCommunityIcons name="trophy-outline" size={20} color={theme.primary} />
                            </View>
                            <Text style={styles.actionLabel}>Challenges</Text>
                            <MaterialCommunityIcons name="chevron-right" size={18} color={theme.textTertiary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => router.push('/(dash)/(tabs)/progress')}
                        >
                            <View style={styles.actionIconBg}>
                                <MaterialCommunityIcons name="chart-line" size={20} color={theme.primary} />
                            </View>
                            <Text style={styles.actionLabel}>My Progress</Text>
                            <MaterialCommunityIcons name="chevron-right" size={18} color={theme.textTertiary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => router.push('/(dash)/(tabs)/workouts')}
                        >
                            <View style={styles.actionIconBg}>
                                <MaterialCommunityIcons name="history" size={20} color={theme.primary} />
                            </View>
                            <Text style={styles.actionLabel}>History</Text>
                            <MaterialCommunityIcons name="chevron-right" size={18} color={theme.textTertiary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Active Challenges */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Active Challenges</Text>
                        <TouchableOpacity onPress={() => router.push('/(dash)/(tabs)/challenges')}>
                            <Text style={styles.viewAll}>View All</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.challengeEmptyCard}>
                        <View style={styles.emptyIconCircle}>
                            <MaterialCommunityIcons name="trophy-variant-outline" size={32} color={theme.textTertiary} />
                        </View>
                        <Text style={styles.emptyText}>No active challenges</Text>
                        <Text style={styles.emptySubtext}>Join a challenge to compete with friends</Text>
                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => router.push('/(dash)/(tabs)/challenges')}
                        >
                            <Text style={styles.secondaryButtonText}>Browse Challenges</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Friends' Recent Activities */}
                <View style={[styles.section, { marginBottom: 100 }]}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Friends' Recent Activities</Text>
                        <TouchableOpacity onPress={() => router.push('/(dash)/friends')}>
                            <Text style={styles.viewAll}>View All</Text>
                        </TouchableOpacity>
                    </View>
                    {friendActivities.length === 0 ? (
                        <View style={styles.emptyActivityCard}>
                            <View style={styles.emptyIconCircle}>
                                <MaterialCommunityIcons name="account-group-outline" size={32} color={theme.textTertiary} />
                            </View>
                            <Text style={styles.emptyText}>No friend activities</Text>
                            <Text style={styles.emptySubtext}>Add friends to see their workouts</Text>
                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => router.push('/(dash)/(tabs)/challenges')}
                            >
                                <Text style={styles.secondaryButtonText}>Find Friends</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.activitiesList}>
                            {friendActivities.map((activity) => (
                                <TouchableOpacity
                                    key={activity.id}
                                    style={styles.activityCard}
                                    onPress={() => router.push(`/(dash)/user-profile?userId=${activity.userId}`)}
                                >
                                    <View style={styles.activityLeft}>
                                        <View style={styles.activityAvatar}>
                                            <MaterialCommunityIcons name="account" size={24} color={theme.primary} />
                                        </View>
                                        <View style={styles.activityInfo}>
                                            <Text style={styles.activityUserName}>
                                                {activity.userName}
                                            </Text>
                                            <Text style={styles.activityWorkoutName}>
                                                {activity.workoutName}
                                            </Text>
                                            <View style={styles.activityMeta}>
                                                <MaterialCommunityIcons name="clock-outline" size={12} color={theme.textTertiary} />
                                                <Text style={styles.activityMetaText}>{activity.duration} min</Text>
                                                <MaterialCommunityIcons name="weight-lifter" size={12} color={theme.textTertiary} style={{ marginLeft: 8 }} />
                                                <Text style={styles.activityMetaText}>{activity.exerciseCount} exercises</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={styles.activityRight}>
                                        <Text style={styles.activityTime}>
                                            {getTimeAgo(activity.date)}
                                        </Text>
                                        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textTertiary} />
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    )
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
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    greeting: {
        fontSize: 14,
        color: theme.textSecondary,
        marginBottom: 4,
        fontWeight: '400',
    },
    userName: {
        fontSize: 26,
        fontWeight: '700',
        color: theme.text,
    },
    notificationButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.border,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    notificationBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: theme.accent,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 24,
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
        marginBottom: 12,
    },
    viewAll: {
        fontSize: 14,
        color: theme.primary,
        fontWeight: '600',
    },
    todayMainCard: {
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 20,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        borderWidth: isDark ? 1 : 0,
        shadowRadius: 8,
        elevation: 2,
    },
    todayHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    todayLabel: {
        fontSize: 12,
        color: theme.textTertiary,
        fontWeight: '500',
        marginBottom: 4,
    },
    todayDate: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.text,
    },
    streakBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? theme.primaryLight : '#FFF5F0',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
    },
    streakText: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.accent,
    },
    startWorkoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.background,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: theme.border,
    },
    startButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    playIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    startButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.text,
        marginBottom: 2,
    },
    startButtonSubtext: {
        fontSize: 13,
        color: theme.textTertiary,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 16,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        borderWidth: isDark ? 1 : 0,
        shadowRadius: 8,
        elevation: 2,
    },
    statCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '800',
        color: theme.text,
    },
    statLabel: {
        fontSize: 13,
        color: theme.textSecondary,
        fontWeight: '500',
        marginBottom: 8,
    },
    statTrend: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statTrendText: {
        fontSize: 12,
        color: theme.textTertiary,
        fontWeight: '500',
    },
    actionsContainer: {
        gap: 10,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 16,
    },
    actionIconBg: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    actionLabel: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: theme.text,
    },
    challengeEmptyCard: {
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 32,
        alignItems: 'center',
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        borderWidth: isDark ? 1 : 0,
        shadowRadius: 8,
        elevation: 2,
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
    emptyActivityCard: {
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 32,
        alignItems: 'center',
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        borderWidth: isDark ? 1 : 0,
        shadowRadius: 8,
        elevation: 2,
    },
    activitiesList: {
        gap: 12,
    },
    activityCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 16,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        borderWidth: isDark ? 1 : 0,
        shadowRadius: 8,
        elevation: 2,
    },
    activityLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    activityAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    activityInfo: {
        flex: 1,
    },
    activityUserName: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.text,
        marginBottom: 4,
    },
    activityWorkoutName: {
        fontSize: 14,
        fontWeight: '500',
        color: theme.textSecondary,
        marginBottom: 4,
    },
    activityMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    activityMetaText: {
        fontSize: 12,
        color: theme.textTertiary,
        marginLeft: 4,
    },
    activityRight: {
        alignItems: 'flex-end',
        marginLeft: 12,
    },
    activityTime: {
        fontSize: 12,
        color: theme.textTertiary,
        fontWeight: '500',
        marginBottom: 4,
    },
})