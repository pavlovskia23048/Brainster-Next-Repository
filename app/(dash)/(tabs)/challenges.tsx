import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, TextInput, FlatList, ActivityIndicator, RefreshControl, Image } from 'react-native';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Text } from '@/components/common/Text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, getDocs, query, where, orderBy as firestoreOrderBy, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

type LeaderboardCategory = 'streak' | 'points' | 'workouts' | 'level';
type TimePeriod = 'all' | 'month' | 'week';
type ViewMode = 'global' | 'friends';

interface User {
    uid: string;
    displayName: string;
    email: string;
    photoURL?: string;
    stats: {
        totalWorkouts: number;
        points: number;
        level: number;
        streak: number;
    };
    weeklyWorkouts?: number;
    monthlyWorkouts?: number;
    weeklyPoints?: number;
    monthlyPoints?: number;
}

interface LeaderboardUser extends User {
    rank: number;
    score: number;
    rankChange?: number; // For future implementation
}

export default function Challenges() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const currentUserId = auth.currentUser?.uid;

    const [users, setUsers] = useState<User[]>([]);
    const [friendIds, setFriendIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Filters
    const [category, setCategory] = useState<LeaderboardCategory>('streak');
    const [period, setPeriod] = useState<TimePeriod>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('global');

    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

    // Refresh data when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    // Manual refresh handler for pull-to-refresh
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);

            // Load all users
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const usersData = usersSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    uid: doc.id,
                    displayName: data.displayName || 'Unknown',
                    email: data.email || '',
                    photoURL: data.photoURL || '',
                    stats: {
                        totalWorkouts: data.stats?.totalWorkouts || 0,
                        points: data.stats?.points || 0,
                        level: data.stats?.level || 1,
                        streak: data.stats?.streak || 0,
                    }
                };
            }) as User[];

            // Load friendships
            if (currentUserId) {
                const friendshipsRef = collection(db, 'friendships');
                const q = query(friendshipsRef, where('users', 'array-contains', currentUserId));
                const friendshipsSnapshot = await getDocs(q);

                // Use Set to prevent duplicate friend IDs
                const friendsSet = new Set<string>();
                friendshipsSnapshot.docs.forEach(doc => {
                    const users = doc.data().users;
                    const friendId = users.find((id: string) => id !== currentUserId);
                    if (friendId) friendsSet.add(friendId);
                });
                setFriendIds(Array.from(friendsSet));
            }

            // Load workout logs for time-based calculations
            await enrichUsersWithTimeBasedStats(usersData);

            setUsers(usersData);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const enrichUsersWithTimeBasedStats = async (users: User[]) => {
        try {
            // Get current week and month timestamps
            const now = new Date();
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - 7);
            weekStart.setHours(0, 0, 0, 0);

            const monthStart = new Date(now);
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);

            // Load workout logs
            const workoutLogsSnapshot = await getDocs(collection(db, 'workoutLogs'));

            // Calculate weekly and monthly stats for each user
            const userStats = new Map<string, { weeklyWorkouts: number; monthlyWorkouts: number; weeklyPoints: number; monthlyPoints: number }>();

            workoutLogsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const userId = data.userId;
                const workoutDate = data.date?.toDate();

                if (!workoutDate || !userId) return;

                if (!userStats.has(userId)) {
                    userStats.set(userId, {
                        weeklyWorkouts: 0,
                        monthlyWorkouts: 0,
                        weeklyPoints: 0,
                        monthlyPoints: 0
                    });
                }

                const stats = userStats.get(userId)!;
                const pointsEarned = 10; // Points per workout

                if (workoutDate >= weekStart) {
                    stats.weeklyWorkouts++;
                    stats.weeklyPoints += pointsEarned;
                }
                if (workoutDate >= monthStart) {
                    stats.monthlyWorkouts++;
                    stats.monthlyPoints += pointsEarned;
                }
            });

            // Enrich users with calculated stats
            users.forEach(user => {
                const stats = userStats.get(user.uid);
                if (stats) {
                    user.weeklyWorkouts = stats.weeklyWorkouts;
                    user.monthlyWorkouts = stats.monthlyWorkouts;
                    user.weeklyPoints = stats.weeklyPoints;
                    user.monthlyPoints = stats.monthlyPoints;
                } else {
                    user.weeklyWorkouts = 0;
                    user.monthlyWorkouts = 0;
                    user.weeklyPoints = 0;
                    user.monthlyPoints = 0;
                }
            });
        } catch (error) {
            console.error('Error enriching user stats:', error);
        }
    };

    // Filter and sort users based on current selections
    const leaderboardUsers = useMemo((): LeaderboardUser[] => {
        let filteredUsers = [...users];

        // Apply view mode filter (global or friends)
        if (viewMode === 'friends') {
            filteredUsers = filteredUsers.filter(user =>
                friendIds.includes(user.uid) || user.uid === currentUserId
            );
        }

        // Apply search filter
        if (searchQuery.trim()) {
            filteredUsers = filteredUsers.filter(user =>
                user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.email.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Determine score based on category and period
        const usersWithScores = filteredUsers.map(user => {
            let score = 0;

            if (period === 'week') {
                if (category === 'workouts') score = user.weeklyWorkouts || 0;
                else if (category === 'points') score = user.weeklyPoints || 0;
                else if (category === 'streak') score = user.stats.streak || 0;
                else if (category === 'level') score = user.stats.level || 1;
            } else if (period === 'month') {
                if (category === 'workouts') score = user.monthlyWorkouts || 0;
                else if (category === 'points') score = user.monthlyPoints || 0;
                else if (category === 'streak') score = user.stats.streak || 0;
                else if (category === 'level') score = user.stats.level || 1;
            } else { // all time
                if (category === 'workouts') score = user.stats.totalWorkouts || 0;
                else if (category === 'points') score = user.stats.points || 0;
                else if (category === 'streak') score = user.stats.streak || 0;
                else if (category === 'level') score = user.stats.level || 1;
            }

            return { ...user, score };
        });

        // Sort by score descending
        usersWithScores.sort((a, b) => b.score - a.score);

        // Assign ranks
        return usersWithScores.map((user, index) => ({
            ...user,
            rank: index + 1,
        }));
    }, [users, friendIds, viewMode, category, period, searchQuery, currentUserId]);

    // Get current user's rank
    const currentUserRank = useMemo(() => {
        return leaderboardUsers.find(u => u.uid === currentUserId);
    }, [leaderboardUsers, currentUserId]);

    // Top 3 and rest
    const topThree = leaderboardUsers.slice(0, 3);
    const restOfUsers = leaderboardUsers.slice(3);

    const getCategoryLabel = (cat: LeaderboardCategory) => {
        const labels = {
            streak: 'Streak',
            points: 'Points',
            workouts: 'Workouts',
            level: 'Level'
        };
        return labels[cat];
    };

    const getCategoryIcon = (cat: LeaderboardCategory) => {
        const icons = {
            streak: 'fire',
            points: 'star',
            workouts: 'dumbbell',
            level: 'trophy-variant'
        };
        return icons[cat];
    };

    const getScoreLabel = (user: LeaderboardUser) => {
        if (category === 'streak') return `${user.score} days`;
        if (category === 'points') return `${user.score} pts`;
        if (category === 'workouts') return `${user.score} workouts`;
        if (category === 'level') return `Level ${user.score}`;
        return `${user.score}`;
    };

    const getPeriodLabel = (p: TimePeriod) => {
        const labels = {
            all: 'All Time',
            month: 'This Month',
            week: 'This Week'
        };
        return labels[p];
    };

    const getPodiumHeight = (position: number) => {
        if (position === 0) return 120; // 1st place
        if (position === 1) return 100; // 2nd place
        return 80; // 3rd place
    };

    const getPodiumColor = (position: number) => {
        if (position === 0) return '#FFD700'; // Gold
        if (position === 1) return '#C0C0C0'; // Silver
        return '#CD7F32'; // Bronze
    };

    const handleUserPress = (userId: string) => {
        router.push(`/(dash)/user-profile?userId=${userId}`);
    };

    const getLastUpdatedText = () => {
        if (!lastUpdated) return '';

        const now = new Date();
        const diffMs = now.getTime() - lastUpdated.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins === 1) return '1 min ago';
        if (diffMins < 60) return `${diffMins} mins ago`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours === 1) return '1 hour ago';
        if (diffHours < 24) return `${diffHours} hours ago`;

        return lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    const renderUserRow = ({ item, index }: { item: LeaderboardUser; index: number }) => {
        const isCurrentUser = item.uid === currentUserId;

        return (
            <TouchableOpacity
                style={[styles.userRow, isCurrentUser && styles.currentUserRow]}
                onPress={() => handleUserPress(item.uid)}
            >
                <View style={styles.rankContainer}>
                    <Text style={[styles.rankText, isCurrentUser && styles.currentUserText]}>
                        {item.rank}
                    </Text>
                </View>
                <View style={[styles.userAvatar, isCurrentUser && styles.currentUserAvatar]}>
                    {item.photoURL ? (
                        <Image
                            source={{ uri: item.photoURL }}
                            style={styles.userAvatarImage}
                        />
                    ) : (
                        <MaterialCommunityIcons name="account" size={24} color={isCurrentUser ? theme.surface : theme.primary} />
                    )}
                </View>
                <View style={styles.userInfo}>
                    <View style={styles.userNameRow}>
                        <Text style={[styles.userName, isCurrentUser && styles.currentUserText]}>
                            {item.displayName}
                        </Text>
                        {isCurrentUser && (
                            <View style={styles.youBadge}>
                                <Text style={styles.youBadgeText}>YOU</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.userStats}>
                        {item.stats.totalWorkouts} workouts • Level {item.stats.level}
                    </Text>
                </View>
                <View style={styles.scoreContainer}>
                    <MaterialCommunityIcons
                        name={getCategoryIcon(category)}
                        size={16}
                        color={isCurrentUser ? theme.primary : theme.accent}
                    />
                    <Text style={[styles.scoreText, isCurrentUser && styles.currentUserText]}>
                        {item.score}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={styles.loadingText}>Loading leaderboard...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <View>
                        <Text style={styles.headerTitle}>Leaderboard</Text>
                        <Text style={styles.headerSubtitle}>Compete with friends</Text>
                    </View>
                    {lastUpdated && (
                        <View style={styles.lastUpdatedContainer}>
                            <MaterialCommunityIcons name="refresh" size={12} color={theme.textTertiary} />
                            <Text style={styles.lastUpdatedText}>{getLastUpdatedText()}</Text>
                        </View>
                    )}
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[theme.primary]}
                        tintColor={theme.primary}
                    />
                }
            >
                {/* View Mode Toggle */}
                <View style={styles.toggleSection}>
                    <TouchableOpacity
                        style={[styles.toggleButton, viewMode === 'global' && styles.toggleButtonActive]}
                        onPress={() => setViewMode('global')}
                    >
                        <MaterialCommunityIcons
                            name="earth"
                            size={18}
                            color={viewMode === 'global' ? theme.surface : theme.textSecondary}
                        />
                        <Text style={[styles.toggleText, viewMode === 'global' && styles.toggleTextActive]}>
                            Global
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleButton, viewMode === 'friends' && styles.toggleButtonActive]}
                        onPress={() => setViewMode('friends')}
                    >
                        <MaterialCommunityIcons
                            name="account-group"
                            size={18}
                            color={viewMode === 'friends' ? theme.surface : theme.textSecondary}
                        />
                        <Text style={[styles.toggleText, viewMode === 'friends' && styles.toggleTextActive]}>
                            Friends
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Category Selector */}
                <View style={styles.categorySection}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoryScroll}
                    >
                        {(['streak', 'points', 'workouts', 'level'] as LeaderboardCategory[]).map(cat => (
                            <TouchableOpacity
                                key={cat}
                                style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
                                onPress={() => setCategory(cat)}
                            >
                                <MaterialCommunityIcons
                                    name={getCategoryIcon(cat)}
                                    size={16}
                                    color={category === cat ? theme.surface : theme.primary}
                                />
                                <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}>
                                    {getCategoryLabel(cat)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Period Selector */}
                <View style={styles.periodSection}>
                    <View style={styles.periodContainer}>
                        {(['all', 'month', 'week'] as TimePeriod[]).map(p => (
                            <TouchableOpacity
                                key={p}
                                style={[styles.periodOption, period === p && styles.periodOptionActive]}
                                onPress={() => setPeriod(p)}
                            >
                                <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                                    {getPeriodLabel(p)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Current User Rank Card */}
                {currentUserRank && (
                    <View style={styles.currentUserCard}>
                        <View style={styles.currentUserCardHeader}>
                            <Text style={styles.currentUserCardTitle}>Your Rank</Text>
                            <View style={styles.rankBadge}>
                                <MaterialCommunityIcons name="trophy" size={16} color={theme.warning} />
                                <Text style={styles.rankBadgeText}>#{currentUserRank.rank}</Text>
                            </View>
                        </View>
                        <View style={styles.currentUserCardStats}>
                            <View style={styles.currentUserStat}>
                                <MaterialCommunityIcons name={getCategoryIcon(category)} size={20} color={theme.primary} />
                                <Text style={styles.currentUserStatValue}>{currentUserRank.score}</Text>
                                <Text style={styles.currentUserStatLabel}>{getCategoryLabel(category)}</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.currentUserStat}>
                                <MaterialCommunityIcons name="account-group" size={20} color={theme.success} />
                                <Text style={styles.currentUserStatValue}>{leaderboardUsers.length}</Text>
                                <Text style={styles.currentUserStatLabel}>Competing</Text>
                            </View>
                            {currentUserRank.rank <= 3 && (
                                <>
                                    <View style={styles.statDivider} />
                                    <View style={styles.currentUserStat}>
                                        <MaterialCommunityIcons
                                            name={currentUserRank.rank === 1 ? "crown" : "medal"}
                                            size={20}
                                            color={getPodiumColor(currentUserRank.rank - 1)}
                                        />
                                        <Text style={styles.currentUserStatValue}>Top 3</Text>
                                        <Text style={styles.currentUserStatLabel}>Position</Text>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                )}

                {/* Podium */}
                {topThree.length > 0 && (
                    <View style={styles.podiumSection}>
                        <View style={styles.podiumContainer}>
                            {/* 2nd Place */}
                            {topThree[1] && (
                                <TouchableOpacity
                                    style={styles.podiumItem}
                                    onPress={() => handleUserPress(topThree[1].uid)}
                                >
                                    <View style={styles.podiumAvatar}>
                                        {topThree[1].photoURL ? (
                                            <Image
                                                source={{ uri: topThree[1].photoURL }}
                                                style={styles.podiumAvatarImage}
                                            />
                                        ) : (
                                            <MaterialCommunityIcons name="account" size={32} color={theme.primary} />
                                        )}
                                    </View>
                                    <Text style={styles.podiumName} numberOfLines={1}>
                                        {topThree[1].displayName}
                                    </Text>
                                    <View style={[styles.podiumBase, { height: getPodiumHeight(1), backgroundColor: getPodiumColor(1) }]}>
                                        <Text style={styles.podiumRank}>2</Text>
                                        <Text style={styles.podiumPoints}>{getScoreLabel(topThree[1])}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}

                            {/* 1st Place */}
                            {topThree[0] && (
                                <TouchableOpacity
                                    style={styles.podiumItem}
                                    onPress={() => handleUserPress(topThree[0].uid)}
                                >
                                    <View style={styles.crownContainer}>
                                        <MaterialCommunityIcons name="crown" size={24} color={theme.warning} />
                                    </View>
                                    <View style={styles.podiumAvatar}>
                                        {topThree[0].photoURL ? (
                                            <Image
                                                source={{ uri: topThree[0].photoURL }}
                                                style={styles.podiumAvatarImage}
                                            />
                                        ) : (
                                            <MaterialCommunityIcons name="account" size={36} color={theme.primary} />
                                        )}
                                    </View>
                                    <Text style={styles.podiumName} numberOfLines={1}>
                                        {topThree[0].displayName}
                                    </Text>
                                    <View style={[styles.podiumBase, { height: getPodiumHeight(0), backgroundColor: getPodiumColor(0) }]}>
                                        <Text style={styles.podiumRank}>1</Text>
                                        <Text style={styles.podiumPoints}>{getScoreLabel(topThree[0])}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}

                            {/* 3rd Place */}
                            {topThree[2] && (
                                <TouchableOpacity
                                    style={styles.podiumItem}
                                    onPress={() => handleUserPress(topThree[2].uid)}
                                >
                                    <View style={styles.podiumAvatar}>
                                        {topThree[2].photoURL ? (
                                            <Image
                                                source={{ uri: topThree[2].photoURL }}
                                                style={styles.podiumAvatarImage}
                                            />
                                        ) : (
                                            <MaterialCommunityIcons name="account" size={28} color={theme.primary} />
                                        )}
                                    </View>
                                    <Text style={styles.podiumName} numberOfLines={1}>
                                        {topThree[2].displayName}
                                    </Text>
                                    <View style={[styles.podiumBase, { height: getPodiumHeight(2), backgroundColor: getPodiumColor(2) }]}>
                                        <Text style={styles.podiumRank}>3</Text>
                                        <Text style={styles.podiumPoints}>{getScoreLabel(topThree[2])}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}

                {/* Search Bar */}
                <View style={styles.searchSection}>
                    <View style={styles.searchContainer}>
                        <MaterialCommunityIcons name="magnify" size={20} color={theme.textTertiary} style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search users..."
                            placeholderTextColor={theme.textTertiary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <MaterialCommunityIcons name="close-circle" size={20} color={theme.textTertiary} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Users List */}
                <View style={[styles.section, { marginBottom: 100 }]}>
                    <Text style={styles.sectionTitle}>
                        Rankings ({leaderboardUsers.length})
                    </Text>
                    {leaderboardUsers.length === 0 ? (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="account-search" size={48} color={theme.textTertiary} />
                            <Text style={styles.emptyText}>
                                {viewMode === 'friends' ? 'No friends found' : 'No users found'}
                            </Text>
                            {viewMode === 'friends' && friendIds.length === 0 && (
                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    onPress={() => setViewMode('global')}
                                >
                                    <Text style={styles.secondaryButtonText}>View Global Leaderboard</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : (
                        <View style={styles.usersList}>
                            {/* Top 3 in list format */}
                            {topThree.map((user) => (
                                <TouchableOpacity
                                    key={user.uid}
                                    style={[
                                        styles.userRow,
                                        styles.topUserRow,
                                        user.uid === currentUserId && styles.currentUserRow
                                    ]}
                                    onPress={() => handleUserPress(user.uid)}
                                >
                                    <View style={[styles.rankContainer, styles.topRankContainer]}>
                                        <MaterialCommunityIcons
                                            name={user.rank === 1 ? "trophy" : "medal"}
                                            size={20}
                                            color={getPodiumColor(user.rank - 1)}
                                        />
                                    </View>
                                    <View style={[styles.userAvatar, user.uid === currentUserId && styles.currentUserAvatar]}>
                                        {user.photoURL ? (
                                            <Image
                                                source={{ uri: user.photoURL }}
                                                style={styles.userAvatarImage}
                                            />
                                        ) : (
                                            <MaterialCommunityIcons
                                                name="account"
                                                size={24}
                                                color={user.uid === currentUserId ? theme.surface : theme.primary}
                                            />
                                        )}
                                    </View>
                                    <View style={styles.userInfo}>
                                        <View style={styles.userNameRow}>
                                            <Text style={[styles.userName, user.uid === currentUserId && styles.currentUserText]}>
                                                {user.displayName}
                                            </Text>
                                            {user.uid === currentUserId && (
                                                <View style={styles.youBadge}>
                                                    <Text style={styles.youBadgeText}>YOU</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.userStats}>
                                            {user.stats.totalWorkouts} workouts • Level {user.stats.level}
                                        </Text>
                                    </View>
                                    <View style={styles.scoreContainer}>
                                        <MaterialCommunityIcons
                                            name={getCategoryIcon(category)}
                                            size={16}
                                            color={user.uid === currentUserId ? theme.primary : theme.accent}
                                        />
                                        <Text style={[styles.scoreText, user.uid === currentUserId && styles.currentUserText]}>
                                            {user.score}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ))}

                            <FlatList
                                data={restOfUsers}
                                renderItem={renderUserRow}
                                keyExtractor={item => item.uid}
                                scrollEnabled={false}
                            />
                        </View>
                    )}
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
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: theme.surface,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '700',
        color: theme.text,
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: theme.textSecondary,
    },
    lastUpdatedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : theme.background,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    lastUpdatedText: {
        fontSize: 11,
        color: theme.textTertiary,
        fontWeight: '500',
    },
    toggleSection: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
        flexDirection: 'row',
        gap: 10,
    },
    toggleButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: theme.surface,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: theme.border,
    },
    toggleButtonActive: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
    },
    toggleText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.textSecondary,
    },
    toggleTextActive: {
        color: theme.surface,
    },
    categorySection: {
        paddingLeft: 20,
        paddingVertical: 12,
    },
    categoryScroll: {
        gap: 8,
        paddingRight: 20,
    },
    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: theme.surface,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: theme.border,
    },
    categoryChipActive: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
    },
    categoryChipText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.primary,
    },
    categoryChipTextActive: {
        color: theme.surface,
    },
    periodSection: {
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    periodContainer: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 4,
    },
    periodOption: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    periodOptionActive: {
        backgroundColor: theme.primaryLight,
    },
    periodText: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.textTertiary,
    },
    periodTextActive: {
        color: theme.primary,
    },
    currentUserCard: {
        marginHorizontal: 20,
        marginVertical: 12,
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 20,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.08,
        shadowRadius: 12,
        elevation: 4,
        borderWidth: 2,
        borderColor: theme.primary,
    },
    currentUserCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    currentUserCardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.text,
    },
    rankBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FFF9E6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    rankBadgeText: {
        fontSize: 16,
        fontWeight: '800',
        color: theme.primary,
    },
    currentUserCardStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    currentUserStat: {
        alignItems: 'center',
        gap: 4,
    },
    currentUserStatValue: {
        fontSize: 20,
        fontWeight: '800',
        color: theme.text,
        marginTop: 4,
    },
    currentUserStatLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: theme.textTertiary,
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: theme.border,
    },
    podiumSection: {
        backgroundColor: theme.surface,
        paddingVertical: 32,
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    podiumContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 12,
    },
    podiumItem: {
        alignItems: 'center',
        flex: 1,
    },
    crownContainer: {
        marginBottom: 8,
    },
    podiumAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: theme.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        borderWidth: 3,
        borderColor: theme.surface,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.1,
        shadowRadius: 4,
        elevation: 3,
        overflow: 'hidden',
    },
    podiumAvatarImage: {
        width: 64,
        height: 64,
        borderRadius: 32,
    },
    podiumName: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.text,
        marginBottom: 8,
        textAlign: 'center',
    },
    podiumBase: {
        width: '100%',
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 12,
    },
    podiumRank: {
        fontSize: 24,
        fontWeight: '800',
        color: theme.surface,
        marginBottom: 4,
    },
    podiumPoints: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.surface,
    },
    searchSection: {
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.surface,
        borderRadius: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: theme.border,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 15,
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
    usersList: {
        backgroundColor: theme.surface,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    topUserRow: {
        backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FFFBF0',
    },
    currentUserRow: {
        backgroundColor: isDark ? 'rgba(27, 49, 108, 0.2)' : theme.primaryLight,
        borderLeftWidth: 4,
        borderLeftColor: theme.primary,
    },
    rankContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    topRankContainer: {
        backgroundColor: 'transparent',
    },
    rankText: {
        fontSize: 14,
        fontWeight: '700',
        color: theme.textSecondary,
    },
    userAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        overflow: 'hidden',
    },
    userAvatarImage: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    currentUserAvatar: {
        backgroundColor: theme.primary,
    },
    userInfo: {
        flex: 1,
    },
    userNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 2,
    },
    userName: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.text,
    },
    currentUserText: {
        color: theme.primary,
        fontWeight: '700',
    },
    youBadge: {
        backgroundColor: theme.primary,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    youBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: theme.surface,
    },
    userStats: {
        fontSize: 13,
        color: theme.textTertiary,
    },
    scoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    scoreText: {
        fontSize: 15,
        fontWeight: '700',
        color: theme.text,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
        backgroundColor: theme.surface,
        borderRadius: 16,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    emptyText: {
        fontSize: 15,
        color: theme.textTertiary,
        marginTop: 12,
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
});
