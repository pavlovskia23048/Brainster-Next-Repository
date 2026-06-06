import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, FlatList, Image } from 'react-native';
import React, { useState, useEffect, useMemo } from 'react';
import { Text } from '@/components/common/Text';
import { auth, db } from '@/config/firebase';
import { useRouter } from 'expo-router';
import { safeBack } from '@/utils/navigation';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

interface Friend {
    uid: string;
    displayName: string;
    email: string;
    photoURL?: string;
    stats: {
        totalWorkouts: number;
        points: number;
        level: number;
    };
}

export default function Friends() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const [friends, setFriends] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(true);
    const currentUserId = auth.currentUser?.uid;

    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

    useEffect(() => {
        if (currentUserId) {
            loadFriends();
        }
    }, [currentUserId]);

    const loadFriends = async () => {
        if (!currentUserId) return;

        try {
            // Get all friendships involving current user
            const friendshipsRef = collection(db, 'friendships');
            const q = query(friendshipsRef, where('users', 'array-contains', currentUserId));
            const snapshot = await getDocs(q);

            // Extract friend IDs using Set to prevent duplicates
            const friendIdsSet = new Set<string>();
            snapshot.docs.forEach(doc => {
                const users = doc.data().users;
                const friendId = users.find((id: string) => id !== currentUserId);
                if (friendId) friendIdsSet.add(friendId);
            });

            // Convert Set to Array
            const friendIds = Array.from(friendIdsSet);

            // Load friend data
            const friendsData: Friend[] = [];
            for (const friendId of friendIds) {
                const userDoc = await getDoc(doc(db, 'users', friendId));
                if (userDoc.exists()) {
                    friendsData.push({
                        uid: userDoc.id,
                        ...userDoc.data()
                    } as Friend);
                }
            }

            // Sort by points
            friendsData.sort((a, b) => b.stats.points - a.stats.points);
            setFriends(friendsData);
        } catch (error) {
            console.error('Error loading friends:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFriendPress = (userId: string) => {
        router.push(`/(dash)/user-profile?userId=${userId}`);
    };

    const renderFriend = ({ item }: { item: Friend }) => (
        <TouchableOpacity
            style={styles.friendCard}
            onPress={() => handleFriendPress(item.uid)}
        >
            <View style={styles.friendAvatar}>
                {item.photoURL ? (
                    <Image
                        source={{ uri: item.photoURL }}
                        style={styles.friendAvatarImage}
                    />
                ) : (
                    <MaterialCommunityIcons name="account" size={32} color={theme.primary} />
                )}
            </View>
            <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{item.displayName}</Text>
                <View style={styles.friendStats}>
                    <View style={styles.statBadge}>
                        <MaterialCommunityIcons name="dumbbell" size={14} color={theme.textSecondary} />
                        <Text style={styles.statBadgeText}>{item.stats.totalWorkouts}</Text>
                    </View>
                    <View style={styles.statBadge}>
                        <MaterialCommunityIcons name="star" size={14} color="#FFD700" />
                        <Text style={styles.statBadgeText}>{item.stats.points}</Text>
                    </View>
                    <View style={styles.statBadge}>
                        <MaterialCommunityIcons name="trophy" size={14} color={theme.textSecondary} />
                        <Text style={styles.statBadgeText}>Lvl {item.stats.level}</Text>
                    </View>
                </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={theme.textTertiary} />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router)}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Friends</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    {loading ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>Loading...</Text>
                        </View>
                    ) : friends.length === 0 ? (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIconCircle}>
                                <MaterialCommunityIcons name="account-group-outline" size={48} color={theme.textTertiary} />
                            </View>
                            <Text style={styles.emptyTitle}>No friends yet</Text>
                            <Text style={styles.emptySubtext}>
                                Visit the leaderboard to find and add friends
                            </Text>
                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={() => router.push('/(dash)/(tabs)/challenges')}
                            >
                                <Text style={styles.primaryButtonText}>Find Friends</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <View style={styles.headerInfo}>
                                <Text style={styles.friendsCount}>{friends.length} {friends.length === 1 ? 'Friend' : 'Friends'}</Text>
                            </View>
                            <FlatList
                                data={friends}
                                renderItem={renderFriend}
                                keyExtractor={item => item.uid}
                                scrollEnabled={false}
                                contentContainerStyle={styles.friendsList}
                            />
                        </>
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
    section: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 100,
    },
    headerInfo: {
        marginBottom: 16,
    },
    friendsCount: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.textSecondary,
    },
    friendsList: {
        gap: 12,
    },
    friendCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        borderWidth: isDark ? 1 : 0,
        borderColor: theme.border,
        shadowRadius: 8,
        elevation: 2,
    },
    friendAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        overflow: 'hidden',
    },
    friendAvatarImage: {
        width: 56,
        height: 56,
        borderRadius: 28,
    },
    friendInfo: {
        flex: 1,
    },
    friendName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.text,
        marginBottom: 6,
    },
    friendStats: {
        flexDirection: 'row',
        gap: 8,
    },
    statBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: theme.surface,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.textSecondary,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: theme.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.text,
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        marginBottom: 24,
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
    },
    primaryButton: {
        backgroundColor: theme.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    primaryButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
