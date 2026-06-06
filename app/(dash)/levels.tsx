import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import React, { useState, useEffect, useMemo } from 'react';
import { Text } from '@/components/common/Text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeBack } from '@/utils/navigation';
import { auth, db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

interface Level {
    level: number;
    name: string;
    pointsRequired: number;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legendary';
    icon: string;
    color: string;
    gradient: string[];
}

const LEVELS: Level[] = [
    // Bronze Tier (1-5)
    { level: 1, name: 'Rookie', pointsRequired: 0, tier: 'bronze', icon: 'star-outline', color: '#CD7F32', gradient: ['#CD7F32', '#B8692A'] },
    { level: 2, name: 'Apprentice', pointsRequired: 50, tier: 'bronze', icon: 'account-star-outline', color: '#CD7F32', gradient: ['#CD7F32', '#B8692A'] },
    { level: 3, name: 'Challenger', pointsRequired: 100, tier: 'bronze', icon: 'fire', color: '#CD7F32', gradient: ['#CD7F32', '#B8692A'] },
    { level: 4, name: 'Warrior', pointsRequired: 200, tier: 'bronze', icon: 'shield-sword', color: '#CD7F32', gradient: ['#CD7F32', '#B8692A'] },
    { level: 5, name: 'Conqueror', pointsRequired: 350, tier: 'bronze', icon: 'flag-checkered', color: '#CD7F32', gradient: ['#CD7F32', '#B8692A'] },

    // Silver Tier (6-10)
    { level: 6, name: 'Champion', pointsRequired: 500, tier: 'silver', icon: 'medal-outline', color: '#C0C0C0', gradient: ['#C0C0C0', '#A8A8A8'] },
    { level: 7, name: 'Gladiator', pointsRequired: 700, tier: 'silver', icon: 'sword-cross', color: '#C0C0C0', gradient: ['#C0C0C0', '#A8A8A8'] },
    { level: 8, name: 'Titan', pointsRequired: 950, tier: 'silver', icon: 'lightning-bolt', color: '#C0C0C0', gradient: ['#C0C0C0', '#A8A8A8'] },
    { level: 9, name: 'Hero', pointsRequired: 1250, tier: 'silver', icon: 'star-face', color: '#C0C0C0', gradient: ['#C0C0C0', '#A8A8A8'] },
    { level: 10, name: 'Legend', pointsRequired: 1600, tier: 'silver', icon: 'crown-outline', color: '#C0C0C0', gradient: ['#C0C0C0', '#A8A8A8'] },

    // Gold Tier (11-15)
    { level: 11, name: 'Elite', pointsRequired: 2000, tier: 'gold', icon: 'diamond-stone', color: '#FFD700', gradient: ['#FFD700', '#FFC700'] },
    { level: 12, name: 'Master', pointsRequired: 2500, tier: 'gold', icon: 'ninja', color: '#FFD700', gradient: ['#FFD700', '#FFC700'] },
    { level: 13, name: 'Grandmaster', pointsRequired: 3100, tier: 'gold', icon: 'chess-queen', color: '#FFD700', gradient: ['#FFD700', '#FFC700'] },
    { level: 14, name: 'Immortal', pointsRequired: 3800, tier: 'gold', icon: 'shield-star', color: '#FFD700', gradient: ['#FFD700', '#FFC700'] },
    { level: 15, name: 'Mythic', pointsRequired: 4600, tier: 'gold', icon: 'zodiac-leo', color: '#FFD700', gradient: ['#FFD700', '#FFC700'] },

    // Platinum Tier (16-20)
    { level: 16, name: 'Ascendant', pointsRequired: 5500, tier: 'platinum', icon: 'rocket-launch', color: '#E5E4E2', gradient: ['#E5E4E2', '#C9C9C9'] },
    { level: 17, name: 'Divine', pointsRequired: 6500, tier: 'platinum', icon: 'flash', color: '#E5E4E2', gradient: ['#E5E4E2', '#C9C9C9'] },
    { level: 18, name: 'Celestial', pointsRequired: 7600, tier: 'platinum', icon: 'moon-waning-crescent', color: '#E5E4E2', gradient: ['#E5E4E2', '#C9C9C9'] },
    { level: 19, name: 'Ethereal', pointsRequired: 8800, tier: 'platinum', icon: 'star-shooting', color: '#E5E4E2', gradient: ['#E5E4E2', '#C9C9C9'] },
    { level: 20, name: 'Supreme', pointsRequired: 10100, tier: 'platinum', icon: 'crown', color: '#E5E4E2', gradient: ['#E5E4E2', '#C9C9C9'] },

    // Diamond Tier (21-25)
    { level: 21, name: 'Overlord', pointsRequired: 11500, tier: 'diamond', icon: 'shield-crown', color: '#B9F2FF', gradient: ['#B9F2FF', '#89CFF0'] },
    { level: 22, name: 'Sovereign', pointsRequired: 13000, tier: 'diamond', icon: 'scepter', color: '#B9F2FF', gradient: ['#B9F2FF', '#89CFF0'] },
    { level: 23, name: 'Emperor', pointsRequired: 14600, tier: 'diamond', icon: 'castle', color: '#B9F2FF', gradient: ['#B9F2FF', '#89CFF0'] },
    { level: 24, name: 'Demigod', pointsRequired: 16300, tier: 'diamond', icon: 'shield-half-full', color: '#B9F2FF', gradient: ['#B9F2FF', '#89CFF0'] },
    { level: 25, name: 'Apex Predator', pointsRequired: 18100, tier: 'diamond', icon: 'wolf', color: '#B9F2FF', gradient: ['#B9F2FF', '#89CFF0'] },

    // Legendary Tier (26+)
    { level: 26, name: 'Godlike', pointsRequired: 20000, tier: 'legendary', icon: 'omega', color: '#FF6B9D', gradient: ['#FF6B9D', '#FF1493'] },
    { level: 27, name: 'Transcendent', pointsRequired: 22000, tier: 'legendary', icon: 'infinity', color: '#FF6B9D', gradient: ['#FF6B9D', '#FF1493'] },
    { level: 28, name: 'Unstoppable', pointsRequired: 24500, tier: 'legendary', icon: 'sword', color: '#FF6B9D', gradient: ['#FF6B9D', '#FF1493'] },
    { level: 29, name: 'Indomitable', pointsRequired: 27500, tier: 'legendary', icon: 'shield-alert', color: '#FF6B9D', gradient: ['#FF6B9D', '#FF1493'] },
    { level: 30, name: 'IMMORTAL', pointsRequired: 31000, tier: 'legendary', icon: 'infinity', color: '#FF6B9D', gradient: ['#FF6B9D', '#FF1493'] },
];

export default function Levels() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const [userPoints, setUserPoints] = useState(0);
    const [userLevel, setUserLevel] = useState(1);
    const [loading, setLoading] = useState(true);

    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

    useEffect(() => {
        loadUserData();
    }, []);

    const loadUserData = async () => {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) return;

            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                setUserPoints(data.stats?.points || 0);
                setUserLevel(data.stats?.level || 1);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getCurrentLevel = () => {
        return LEVELS.find(l => l.level === userLevel) || LEVELS[0];
    };

    const getNextLevel = () => {
        return LEVELS.find(l => l.level === userLevel + 1);
    };

    const getProgressToNextLevel = () => {
        const nextLevel = getNextLevel();
        if (!nextLevel) return 100; // Max level

        const currentLevelData = getCurrentLevel();
        const pointsIntoCurrentLevel = userPoints - currentLevelData.pointsRequired;
        const pointsNeededForNextLevel = nextLevel.pointsRequired - currentLevelData.pointsRequired;

        return (pointsIntoCurrentLevel / pointsNeededForNextLevel) * 100;
    };

    const currentLevelData = getCurrentLevel();
    const nextLevelData = getNextLevel();
    const progress = getProgressToNextLevel();

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router)}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Ranks & Levels</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Current Level Card */}
                <View style={styles.section}>
                    <LinearGradient
                        colors={currentLevelData.gradient}
                        style={styles.currentLevelCard}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <View style={styles.currentLevelContent}>
                            <View style={styles.currentLevelBadge}>
                                <MaterialCommunityIcons name={currentLevelData.icon as any} size={48} color="#FFFFFF" />
                            </View>
                            <Text style={styles.currentLevelNumber}>Level {userLevel}</Text>
                            <Text style={styles.currentLevelName}>{currentLevelData.name}</Text>
                            <Text style={styles.currentLevelPoints}>{userPoints} points</Text>
                        </View>
                    </LinearGradient>
                </View>

                {/* Progress to Next Level */}
                {nextLevelData && (
                    <View style={styles.section}>
                        <View style={styles.progressCard}>
                            <View style={styles.progressHeader}>
                                <Text style={styles.progressTitle}>Next: {nextLevelData.name}</Text>
                                <Text style={styles.progressPoints}>
                                    {userPoints} / {nextLevelData.pointsRequired}
                                </Text>
                            </View>
                            <View style={styles.progressBarContainer}>
                                <View style={[styles.progressBar, { width: `${Math.min(progress, 100)}%` }]} />
                            </View>
                            <Text style={styles.progressSubtext}>
                                {nextLevelData.pointsRequired - userPoints} points to next level
                            </Text>
                        </View>
                    </View>
                )}

                {/* All Levels */}
                <View style={[styles.section, { marginBottom: 100 }]}>
                    <Text style={styles.sectionTitle}>All Ranks</Text>

                    {/* Group levels by tier */}
                    {['bronze', 'silver', 'gold', 'platinum', 'diamond', 'legendary'].map(tier => {
                        const tierLevels = LEVELS.filter(l => l.tier === tier);
                        const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);

                        return (
                            <View key={tier} style={styles.tierSection}>
                                <Text style={styles.tierTitle}>{tierName} Tier</Text>
                                {tierLevels.map(level => {
                                    const isUnlocked = userPoints >= level.pointsRequired;
                                    const isCurrent = level.level === userLevel;

                                    return (
                                        <View
                                            key={level.level}
                                            style={[
                                                styles.levelCard,
                                                isCurrent && styles.levelCardCurrent,
                                                !isUnlocked && styles.levelCardLocked,
                                            ]}
                                        >
                                            <View style={styles.levelCardLeft}>
                                                <View
                                                    style={[
                                                        styles.levelBadge,
                                                        !isUnlocked && styles.levelBadgeLocked,
                                                        { backgroundColor: level.color },
                                                    ]}
                                                >
                                                    <MaterialCommunityIcons
                                                        name={isUnlocked ? (level.icon as any) : 'lock'}
                                                        size={28}
                                                        color={isUnlocked ? '#FFFFFF' : theme.textSecondary}
                                                    />
                                                </View>
                                                <View style={styles.levelInfo}>
                                                    <Text style={[styles.levelName, !isUnlocked && styles.textLocked]}>
                                                        {level.name}
                                                    </Text>
                                                    <Text style={[styles.levelNumber, !isUnlocked && styles.textLocked]}>
                                                        Level {level.level}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={styles.levelCardRight}>
                                                <Text style={[styles.levelPoints, !isUnlocked && styles.textLocked]}>
                                                    {level.pointsRequired} pts
                                                </Text>
                                                {isCurrent && (
                                                    <View style={styles.currentBadge}>
                                                        <Text style={styles.currentBadgeText}>CURRENT</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        );
                    })}
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
        marginTop: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.text,
        marginBottom: 16,
    },
    currentLevelCard: {
        borderRadius: 24,
        padding: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    currentLevelContent: {
        alignItems: 'center',
    },
    currentLevelBadge: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 3,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    currentLevelNumber: {
        fontSize: 16,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.9)',
        marginBottom: 4,
    },
    currentLevelName: {
        fontSize: 32,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    currentLevelPoints: {
        fontSize: 18,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.95)',
    },
    progressCard: {
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    progressTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.text,
    },
    progressPoints: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.textSecondary,
    },
    progressBarContainer: {
        height: 12,
        backgroundColor: theme.border,
        borderRadius: 6,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressBar: {
        height: '100%',
        backgroundColor: theme.primary,
        borderRadius: 6,
    },
    progressSubtext: {
        fontSize: 13,
        color: theme.textSecondary,
        textAlign: 'center',
    },
    tierSection: {
        marginBottom: 24,
    },
    tierTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.primary,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    levelCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    levelCardCurrent: {
        borderWidth: 2,
        borderColor: theme.primary,
    },
    levelCardLocked: {
        opacity: 0.5,
    },
    levelCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    levelBadge: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    levelBadgeLocked: {
        backgroundColor: theme.border,
    },
    levelInfo: {
        flex: 1,
    },
    levelName: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.text,
        marginBottom: 4,
    },
    levelNumber: {
        fontSize: 13,
        fontWeight: '500',
        color: theme.textSecondary,
    },
    levelCardRight: {
        alignItems: 'flex-end',
    },
    levelPoints: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.primary,
    },
    textLocked: {
        color: theme.textSecondary,
    },
    currentBadge: {
        backgroundColor: theme.primary,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
        marginTop: 6,
    },
    currentBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
});
