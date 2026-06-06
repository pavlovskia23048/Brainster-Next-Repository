import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { db } from '@/config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Configure notification handler
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

/**
 * Save notification to database
 */
async function saveNotificationToDatabase(
    userId: string,
    title: string,
    body: string,
    type: string,
    data?: any
): Promise<void> {
    try {
        await addDoc(collection(db, 'notifications'), {
            userId,
            title,
            body,
            type,
            data: data || {},
            read: false,
            createdAt: serverTimestamp(),
        });
        console.log('Notification saved to database');
    } catch (error) {
        console.error('Error saving notification to database:', error);
    }
}

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Notification permission not granted');
            return false;
        }

        // For Android, configure notification channel
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#1B316C',
            });
        }

        console.log('Notification permission granted');
        return true;
    } catch (error) {
        console.error('Error requesting notification permissions:', error);
        return false;
    }
}

/**
 * Send a welcome notification
 */
export async function sendWelcomeNotification(userId: string, userName: string): Promise<void> {
    const title = `Welcome to Fitness Hub, ${userName}! 🎉`;
    const body = 'Start your fitness journey today and track your progress!';

    try {
        // Save to database
        await saveNotificationToDatabase(userId, title, body, 'welcome');

        // Try to send push notification (will fail in Expo Go but work in production)
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    sound: true,
                    data: { type: 'welcome' },
                },
                trigger: {
                    seconds: 2,
                },
            });
            console.log('Welcome notification scheduled');
        } catch (pushError) {
            console.log('Push notification not available, but saved to database');
        }
    } catch (error) {
        console.error('Error sending welcome notification:', error);
    }
}

/**
 * Send a first workout congratulations notification
 */
export async function sendFirstWorkoutNotification(userId: string): Promise<void> {
    const title = 'Amazing! First Workout Completed! 💪';
    const body = "You've taken the first step towards your fitness goals. Keep it up!";

    try {
        // Save to database
        await saveNotificationToDatabase(userId, title, body, 'first_workout');

        // Try to send push notification
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    sound: true,
                    data: { type: 'first_workout' },
                },
                trigger: {
                    seconds: 2,
                },
            });
            console.log('First workout notification scheduled');
        } catch (pushError) {
            console.log('Push notification not available, but saved to database');
        }
    } catch (error) {
        console.error('Error sending first workout notification:', error);
    }
}

/**
 * Send a streak milestone notification
 */
export async function sendStreakNotification(userId: string, streak: number): Promise<void> {
    try {
        const milestones = [3, 7, 14, 30, 50, 100];

        if (!milestones.includes(streak)) {
            return;
        }

        let emoji = '🔥';
        let message = '';

        switch (streak) {
            case 3:
                emoji = '🔥';
                message = '3 days in a row! You\'re building momentum!';
                break;
            case 7:
                emoji = '⭐';
                message = 'One week streak! You\'re on fire!';
                break;
            case 14:
                emoji = '🏆';
                message = '2 weeks strong! Incredible consistency!';
                break;
            case 30:
                emoji = '👑';
                message = 'ONE MONTH STREAK! You\'re unstoppable!';
                break;
            case 50:
                emoji = '💎';
                message = '50 days! You\'re a fitness legend!';
                break;
            case 100:
                emoji = '🌟';
                message = '100 DAYS! LEGENDARY STATUS ACHIEVED!';
                break;
        }

        const title = `${emoji} ${streak} Day Streak!`;

        // Save to database
        await saveNotificationToDatabase(userId, title, message, 'streak_milestone', { streak });

        // Try to send push notification
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body: message,
                    sound: true,
                    data: { type: 'streak_milestone', streak },
                },
                trigger: {
                    seconds: 3,
                },
            });
            console.log(`Streak milestone notification scheduled for ${streak} days`);
        } catch (pushError) {
            console.log('Push notification not available, but saved to database');
        }
    } catch (error) {
        console.error('Error sending streak notification:', error);
    }
}

/**
 * Send a level up notification
 */
export async function sendLevelUpNotification(userId: string, level: number, levelName: string): Promise<void> {
    const title = `🎉 Level Up! You're now Level ${level}`;
    const body = `Congratulations! You've achieved the rank of ${levelName}!`;

    try {
        // Save to database
        await saveNotificationToDatabase(userId, title, body, 'level_up', { level, levelName });

        // Try to send push notification
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    sound: true,
                    data: { type: 'level_up', level, levelName },
                },
                trigger: {
                    seconds: 2,
                },
            });
            console.log(`Level up notification scheduled for level ${level}`);
        } catch (pushError) {
            console.log('Push notification not available, but saved to database');
        }
    } catch (error) {
        console.error('Error sending level up notification:', error);
    }
}

/**
 * Send workout reminder notification
 */
export async function sendWorkoutReminder(): Promise<void> {
    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: '💪 Time for Your Workout!',
                body: "Don't break your streak! Get moving today!",
                sound: true,
                data: { type: 'workout_reminder' },
            },
            trigger: {
                hour: 18,
                minute: 0,
                repeats: true,
            },
        });
        console.log('Daily workout reminder scheduled for 6 PM');
    } catch (error) {
        console.error('Error sending workout reminder:', error);
    }
}

/**
 * Send workout invitation notification
 */
export async function sendWorkoutInvitation(
    toUserId: string,
    fromUserName: string,
    message: string,
    invitationId?: string
): Promise<void> {
    const title = `💪 ${fromUserName} invited you to workout!`;
    const body = message || 'Let\'s crush this workout together!';

    try {
        // Build data object, only include invitationId if it's defined
        const notificationData: any = {
            fromUserName,
        };
        if (invitationId) {
            notificationData.invitationId = invitationId;
        }

        // Save to database
        await saveNotificationToDatabase(toUserId, title, body, 'workout_invitation', notificationData);

        // Try to send push notification
        try {
            const pushData: any = { type: 'workout_invitation', fromUserName };
            if (invitationId) {
                pushData.invitationId = invitationId;
            }

            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    sound: true,
                    data: pushData,
                },
                trigger: {
                    seconds: 2,
                },
            });
            console.log('Workout invitation notification sent');
        } catch (pushError) {
            console.log('Push notification not available, but saved to database');
        }
    } catch (error) {
        console.error('Error sending workout invitation:', error);
    }
}
