import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, TextInput } from 'react-native';
import React, { useState, useEffect, useMemo } from 'react';
import { Text } from '@/components/common/Text';
import { auth, db } from '@/config/firebase';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '@/utils/navigation';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import { sendWorkoutInvitation } from '@/utils/notifications';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

interface WorkoutInvitation {
    id: string;
    fromUserId: string;
    fromUserName: string;
    toUserId: string;
    toUserName: string;
    message: string;
    status: 'pending' | 'accepted' | 'declined';
    createdAt: Date;
}

export default function WorkoutInvitationScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { theme, isDark } = useTheme();
    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
    const [invitation, setInvitation] = useState<WorkoutInvitation | null>(null);
    const [loading, setLoading] = useState(true);
    const [responding, setResponding] = useState(false);
    const [responseMessage, setResponseMessage] = useState('');
    const currentUserId = auth.currentUser?.uid;

    useEffect(() => {
        if (id) {
            loadInvitation();
        }
    }, [id]);

    const loadInvitation = async () => {
        try {
            const invitationDoc = await getDoc(doc(db, 'workoutInvitations', id as string));
            if (invitationDoc.exists()) {
                const data = invitationDoc.data();
                setInvitation({
                    id: invitationDoc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate() || new Date(),
                } as WorkoutInvitation);
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Invitation Not Found',
                    text2: 'This invitation may have been deleted',
                    position: 'top',
                });
                safeBack(router);
            }
        } catch (error) {
            console.error('Error loading invitation:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to load invitation',
                position: 'top',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async () => {
        if (!invitation || !currentUserId) return;

        try {
            setResponding(true);

            // Update invitation status
            await updateDoc(doc(db, 'workoutInvitations', invitation.id), {
                status: 'accepted',
            });

            // Send notification to inviter with custom response message
            const acceptMessage = responseMessage.trim()
                ? responseMessage.trim()
                : `${invitation.toUserName} accepted your workout invitation! 💪 Let's do this!`;

            await sendWorkoutInvitation(
                invitation.fromUserId,
                invitation.toUserName,
                acceptMessage,
                undefined
            );

            Toast.show({
                type: 'success',
                text1: 'Invitation Accepted!',
                text2: `You and ${invitation.fromUserName} are working out together!`,
                position: 'top',
            });

            safeBack(router);
        } catch (error) {
            console.error('Error accepting invitation:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to accept invitation',
                position: 'top',
            });
        } finally {
            setResponding(false);
        }
    };

    const handleDecline = async () => {
        if (!invitation || !currentUserId) return;

        try {
            setResponding(true);

            // Update invitation status
            await updateDoc(doc(db, 'workoutInvitations', invitation.id), {
                status: 'declined',
            });

            Toast.show({
                type: 'info',
                text1: 'Invitation Declined',
                text2: 'You can always workout together another time',
                position: 'top',
            });

            safeBack(router);
        } catch (error) {
            console.error('Error declining invitation:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to decline invitation',
                position: 'top',
            });
        } finally {
            setResponding(false);
        }
    };

    const handleDelete = async () => {
        if (!invitation) return;

        try {
            await deleteDoc(doc(db, 'workoutInvitations', invitation.id));

            Toast.show({
                type: 'success',
                text1: 'Invitation Deleted',
                position: 'top',
            });

            safeBack(router);
        } catch (error) {
            console.error('Error deleting invitation:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to delete invitation',
                position: 'top',
            });
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

    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={styles.loadingText}>Loading invitation...</Text>
                </View>
            </View>
        );
    }

    if (!invitation) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />
                <View style={styles.loadingContainer}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={64} color={theme.textTertiary} />
                    <Text style={styles.emptyTitle}>Invitation Not Found</Text>
                </View>
            </View>
        );
    }

    const isPending = invitation.status === 'pending';
    const isReceiver = currentUserId === invitation.toUserId;

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router)}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Workout Invitation</Text>
                {isPending && isReceiver && (
                    <TouchableOpacity onPress={handleDelete}>
                        <MaterialCommunityIcons name="delete-outline" size={24} color={theme.error} />
                    </TouchableOpacity>
                )}
                {(!isPending || !isReceiver) && <View style={{ width: 24 }} />}
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Invitation Card */}
                <View style={styles.section}>
                    <View style={styles.invitationCard}>
                        <View style={styles.iconContainer}>
                            <MaterialCommunityIcons name="dumbbell" size={48} color={theme.primary} />
                        </View>

                        <Text style={styles.fromLabel}>From</Text>
                        <Text style={styles.fromName}>{invitation.fromUserName}</Text>

                        <View style={styles.divider} />

                        <Text style={styles.messageLabel}>Message</Text>
                        <Text style={styles.messageText}>{invitation.message}</Text>

                        <View style={styles.timestampContainer}>
                            <MaterialCommunityIcons name="clock-outline" size={14} color={theme.textTertiary} />
                            <Text style={styles.timestampText}>{getTimeAgo(invitation.createdAt)}</Text>
                        </View>

                        {/* Status Badge */}
                        {!isPending && (
                            <View style={[
                                styles.statusBadge,
                                invitation.status === 'accepted' ? styles.statusAccepted : styles.statusDeclined
                            ]}>
                                <MaterialCommunityIcons
                                    name={invitation.status === 'accepted' ? 'check-circle' : 'close-circle'}
                                    size={16}
                                    color={invitation.status === 'accepted' ? theme.success : theme.error}
                                />
                                <Text style={[
                                    styles.statusText,
                                    invitation.status === 'accepted' ? styles.statusTextAccepted : styles.statusTextDeclined
                                ]}>
                                    {invitation.status === 'accepted' ? 'Accepted' : 'Declined'}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Action Buttons - Only show if pending and user is receiver */}
                {isPending && isReceiver && (
                    <View style={styles.section}>
                        <View style={styles.actionsCard}>
                            <Text style={styles.actionsTitle}>Respond to Invitation</Text>
                            <Text style={styles.actionsSubtext}>
                                {invitation.fromUserName} wants to workout with you!
                            </Text>

                            {/* Response Message Input */}
                            <View style={styles.responseInputContainer}>
                                <Text style={styles.responseInputLabel}>Your Response (Optional)</Text>
                                <TextInput
                                    style={styles.responseInput}
                                    placeholder="Let's crush it! 💪"
                                    placeholderTextColor={theme.textTertiary}
                                    value={responseMessage}
                                    onChangeText={setResponseMessage}
                                    multiline
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                />
                            </View>

                            <View style={styles.actionButtons}>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.acceptButton]}
                                    onPress={handleAccept}
                                    disabled={responding}
                                >
                                    {responding ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <>
                                            <MaterialCommunityIcons name="check-circle" size={20} color="#FFFFFF" />
                                            <Text style={styles.actionButtonText}>Accept</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.actionButton, styles.declineButton]}
                                    onPress={handleDecline}
                                    disabled={responding}
                                >
                                    {responding ? (
                                        <ActivityIndicator size="small" color={theme.textSecondary} />
                                    ) : (
                                        <>
                                            <MaterialCommunityIcons name="close-circle-outline" size={20} color={theme.textSecondary} />
                                            <Text style={styles.declineButtonText}>Decline</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}

                {/* Info if sender */}
                {!isReceiver && (
                    <View style={styles.section}>
                        <View style={styles.infoCard}>
                            <MaterialCommunityIcons name="information-outline" size={24} color={theme.primary} />
                            <Text style={styles.infoText}>
                                You sent this invitation to {invitation.toUserName}.
                                {isPending ? " They haven't responded yet." : ''}
                            </Text>
                        </View>
                    </View>
                )}
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 16,
        color: theme.textTertiary,
        marginTop: 12,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.textTertiary,
        marginTop: 16,
    },
    section: {
        paddingHorizontal: 20,
        marginTop: 24,
    },
    invitationCard: {
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: isDark ? 1 : 0,
        borderColor: theme.border,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: theme.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    fromLabel: {
        fontSize: 14,
        color: theme.textTertiary,
        marginBottom: 4,
    },
    fromName: {
        fontSize: 24,
        fontWeight: '700',
        color: theme.text,
        marginBottom: 20,
    },
    divider: {
        width: '100%',
        height: 1,
        backgroundColor: theme.border,
        marginBottom: 20,
    },
    messageLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.textSecondary,
        marginBottom: 8,
        alignSelf: 'flex-start',
    },
    messageText: {
        fontSize: 16,
        color: theme.text,
        lineHeight: 24,
        textAlign: 'center',
        marginBottom: 16,
    },
    timestampContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    timestampText: {
        fontSize: 13,
        color: theme.textTertiary,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginTop: 16,
    },
    statusAccepted: {
        backgroundColor: isDark ? 'rgba(52, 211, 153, 0.15)' : '#E8F7EE',
    },
    statusDeclined: {
        backgroundColor: isDark ? 'rgba(248, 113, 113, 0.15)' : '#FFE8E8',
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
    },
    statusTextAccepted: {
        color: theme.success,
    },
    statusTextDeclined: {
        color: theme.error,
    },
    actionsCard: {
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: isDark ? 1 : 0,
        borderColor: theme.border,
    },
    actionsTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.text,
        marginBottom: 8,
    },
    actionsSubtext: {
        fontSize: 15,
        color: theme.textSecondary,
        marginBottom: 24,
        lineHeight: 22,
    },
    actionButtons: {
        gap: 12,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        paddingVertical: 16,
        gap: 8,
    },
    acceptButton: {
        backgroundColor: theme.primary,
    },
    declineButton: {
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    declineButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.textSecondary,
    },
    infoCard: {
        flexDirection: 'row',
        backgroundColor: theme.primaryLight,
        borderRadius: 12,
        padding: 16,
        gap: 12,
        alignItems: 'flex-start',
    },
    infoText: {
        flex: 1,
        fontSize: 15,
        color: isDark ? theme.text : theme.primary,
        lineHeight: 22,
    },
    responseInputContainer: {
        marginBottom: 20,
    },
    responseInputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.text,
        marginBottom: 8,
    },
    responseInput: {
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 16,
        fontSize: 15,
        color: theme.text,
        minHeight: 80,
        borderWidth: 1,
        borderColor: theme.border,
    },
});
