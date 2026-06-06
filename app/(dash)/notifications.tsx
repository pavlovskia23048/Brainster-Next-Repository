import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, RefreshControl } from 'react-native';
import React, { useState, useEffect, useMemo } from 'react';
import { Text } from '@/components/common/Text';
import { auth, db } from '@/config/firebase';
import { useRouter } from 'expo-router';
import { safeBack } from '@/utils/navigation';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, deleteDoc, limit } from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

interface Notification {
    id: string;
    userId: string;
    title: string;
    body: string;
    type: string;
    data?: any;
    read: boolean;
    createdAt: Date;
}

export default function Notifications() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const currentUserId = auth.currentUser?.uid;

    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

    useEffect(() => {
        if (currentUserId) {
            loadNotifications();
        }
    }, [currentUserId]);

    const loadNotifications = async () => {
        if (!currentUserId) return;

        try {
            const notificationsRef = collection(db, 'notifications');
            const q = query(
                notificationsRef,
                where('userId', '==', currentUserId),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);

            const notifs: Notification[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
            })) as Notification[];

            setNotifications(notifs);
        } catch (error) {
            console.error('Error loading notifications:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to load notifications',
                position: 'top',
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadNotifications();
    };

    const handleNotificationClick = async (notification: Notification) => {
        // Mark as read
        try {
            await updateDoc(doc(db, 'notifications', notification.id), {
                read: true,
            });

            setNotifications(prev =>
                prev.map(notif =>
                    notif.id === notification.id ? { ...notif, read: true } : notif
                )
            );
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }

        // Handle navigation based on notification type
        if (notification.type === 'workout_invitation') {
            const invitationId = notification.data?.invitationId;

            if (invitationId) {
                router.push(`/(dash)/workout-invitation?id=${invitationId}`);
            } else {
                // Fallback: try to find the invitation
                try {
                    const invitationsRef = collection(db, 'workoutInvitations');
                    const q = query(
                        invitationsRef,
                        where('toUserId', '==', currentUserId),
                        where('fromUserName', '==', notification.data?.fromUserName || ''),
                        limit(1)
                    );
                    const snapshot = await getDocs(q);

                    if (!snapshot.empty) {
                        const foundInvitationId = snapshot.docs[0].id;
                        router.push(`/(dash)/workout-invitation?id=${foundInvitationId}`);
                    } else {
                        Toast.show({
                            type: 'info',
                            text1: 'Invitation Not Found',
                            text2: 'This invitation may have been deleted',
                            position: 'top',
                        });
                    }
                } catch (error) {
                    console.error('Error finding invitation:', error);
                }
            }
        }
        // Add more navigation cases for other notification types here
    };

    const markAsRead = async (notificationId: string) => {
        try {
            await updateDoc(doc(db, 'notifications', notificationId), {
                read: true,
            });

            setNotifications(prev =>
                prev.map(notif =>
                    notif.id === notificationId ? { ...notif, read: true } : notif
                )
            );
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const deleteNotification = async (notificationId: string) => {
        try {
            await deleteDoc(doc(db, 'notifications', notificationId));
            setNotifications(prev => prev.filter(notif => notif.id !== notificationId));

            Toast.show({
                type: 'success',
                text1: 'Notification Deleted',
                position: 'top',
            });
        } catch (error) {
            console.error('Error deleting notification:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to delete notification',
                position: 'top',
            });
        }
    };

    const markAllAsRead = async () => {
        if (!currentUserId) return;

        try {
            const unreadNotifs = notifications.filter(n => !n.read);

            for (const notif of unreadNotifs) {
                await updateDoc(doc(db, 'notifications', notif.id), {
                    read: true,
                });
            }

            setNotifications(prev =>
                prev.map(notif => ({ ...notif, read: true }))
            );

            Toast.show({
                type: 'success',
                text1: 'All notifications marked as read',
                position: 'top',
            });
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'welcome':
                return { name: 'hand-wave', color: theme.accent };
            case 'first_workout':
                return { name: 'dumbbell', color: theme.primary };
            case 'streak_milestone':
                return { name: 'fire', color: theme.accent };
            case 'level_up':
                return { name: 'trophy', color: '#FFD700' };
            case 'workout_invitation':
                return { name: 'account-multiple', color: '#00D9B5' };
            default:
                return { name: 'bell', color: theme.textSecondary };
        }
    };

    const getTimeAgo = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router)}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                {unreadCount > 0 && (
                    <TouchableOpacity onPress={markAllAsRead}>
                        <Text style={styles.markAllText}>Mark all read</Text>
                    </TouchableOpacity>
                )}
                {unreadCount === 0 && <View style={{ width: 40 }} />}
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading notifications...</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.scrollView}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                    }
                >
                    {notifications.length === 0 ? (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="bell-outline" size={64} color={theme.textTertiary} />
                            <Text style={styles.emptyTitle}>No Notifications</Text>
                            <Text style={styles.emptyText}>
                                You'll see notifications here when you have updates
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.notificationsList}>
                            {notifications.map(notification => {
                                const icon = getNotificationIcon(notification.type);
                                return (
                                    <TouchableOpacity
                                        key={notification.id}
                                        style={[
                                            styles.notificationCard,
                                            !notification.read && styles.notificationCardUnread,
                                        ]}
                                        onPress={() => handleNotificationClick(notification)}
                                    >
                                        <View style={[styles.iconContainer, { backgroundColor: `${icon.color}20` }]}>
                                            <MaterialCommunityIcons
                                                name={icon.name as any}
                                                size={24}
                                                color={icon.color}
                                            />
                                        </View>

                                        <View style={styles.notificationContent}>
                                            <View style={styles.notificationHeader}>
                                                <Text style={styles.notificationTitle}>
                                                    {notification.title}
                                                </Text>
                                                {!notification.read && <View style={styles.unreadDot} />}
                                            </View>
                                            <Text style={styles.notificationBody}>{notification.body}</Text>
                                            <Text style={styles.notificationTime}>
                                                {getTimeAgo(notification.createdAt)}
                                            </Text>
                                            {notification.type === 'workout_invitation' && (
                                                <View style={styles.actionHint}>
                                                    <MaterialCommunityIcons name="hand-pointing-right" size={14} color={theme.primary} />
                                                    <Text style={styles.actionHintText}>Tap to respond</Text>
                                                </View>
                                            )}
                                        </View>

                                        <TouchableOpacity
                                            style={styles.deleteButton}
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                deleteNotification(notification.id);
                                            }}
                                        >
                                            <MaterialCommunityIcons name="close" size={20} color={theme.textSecondary} />
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </ScrollView>
            )}
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
    markAllText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.primary,
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
    emptyState: {
        alignItems: 'center',
        paddingVertical: 80,
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.text,
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 15,
        color: theme.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    notificationsList: {
        padding: 20,
        gap: 12,
    },
    notificationCard: {
        flexDirection: 'row',
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    notificationCardUnread: {
        backgroundColor: theme.primaryLight,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    notificationContent: {
        flex: 1,
    },
    notificationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    notificationTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.text,
        flex: 1,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: theme.primary,
        marginLeft: 8,
    },
    notificationBody: {
        fontSize: 14,
        color: theme.textSecondary,
        marginBottom: 8,
        lineHeight: 20,
    },
    notificationTime: {
        fontSize: 12,
        color: theme.textSecondary,
    },
    actionHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
    },
    actionHintText: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.primary,
    },
    deleteButton: {
        padding: 4,
    },
});
