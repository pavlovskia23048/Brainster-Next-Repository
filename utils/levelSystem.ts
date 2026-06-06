import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface Level {
    level: number;
    name: string;
    pointsRequired: number;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legendary';
}

export const LEVELS: Level[] = [
    // Bronze Tier (1-5)
    { level: 1, name: 'Rookie', pointsRequired: 0, tier: 'bronze' },
    { level: 2, name: 'Apprentice', pointsRequired: 50, tier: 'bronze' },
    { level: 3, name: 'Challenger', pointsRequired: 100, tier: 'bronze' },
    { level: 4, name: 'Warrior', pointsRequired: 200, tier: 'bronze' },
    { level: 5, name: 'Conqueror', pointsRequired: 350, tier: 'bronze' },

    // Silver Tier (6-10)
    { level: 6, name: 'Champion', pointsRequired: 500, tier: 'silver' },
    { level: 7, name: 'Gladiator', pointsRequired: 700, tier: 'silver' },
    { level: 8, name: 'Titan', pointsRequired: 950, tier: 'silver' },
    { level: 9, name: 'Hero', pointsRequired: 1250, tier: 'silver' },
    { level: 10, name: 'Legend', pointsRequired: 1600, tier: 'silver' },

    // Gold Tier (11-15)
    { level: 11, name: 'Elite', pointsRequired: 2000, tier: 'gold' },
    { level: 12, name: 'Master', pointsRequired: 2500, tier: 'gold' },
    { level: 13, name: 'Grandmaster', pointsRequired: 3100, tier: 'gold' },
    { level: 14, name: 'Immortal', pointsRequired: 3800, tier: 'gold' },
    { level: 15, name: 'Mythic', pointsRequired: 4600, tier: 'gold' },

    // Platinum Tier (16-20)
    { level: 16, name: 'Ascendant', pointsRequired: 5500, tier: 'platinum' },
    { level: 17, name: 'Divine', pointsRequired: 6500, tier: 'platinum' },
    { level: 18, name: 'Celestial', pointsRequired: 7600, tier: 'platinum' },
    { level: 19, name: 'Ethereal', pointsRequired: 8800, tier: 'platinum' },
    { level: 20, name: 'Supreme', pointsRequired: 10100, tier: 'platinum' },

    // Diamond Tier (21-25)
    { level: 21, name: 'Overlord', pointsRequired: 11500, tier: 'diamond' },
    { level: 22, name: 'Sovereign', pointsRequired: 13000, tier: 'diamond' },
    { level: 23, name: 'Emperor', pointsRequired: 14600, tier: 'diamond' },
    { level: 24, name: 'Demigod', pointsRequired: 16300, tier: 'diamond' },
    { level: 25, name: 'Apex Predator', pointsRequired: 18100, tier: 'diamond' },

    // Legendary Tier (26+)
    { level: 26, name: 'Godlike', pointsRequired: 20000, tier: 'legendary' },
    { level: 27, name: 'Transcendent', pointsRequired: 22000, tier: 'legendary' },
    { level: 28, name: 'Unstoppable', pointsRequired: 24500, tier: 'legendary' },
    { level: 29, name: 'Indomitable', pointsRequired: 27500, tier: 'legendary' },
    { level: 30, name: 'IMMORTAL', pointsRequired: 31000, tier: 'legendary' },
];

/**
 * Calculate the user's level based on their total points
 */
export const calculateLevel = (points: number): number => {
    // Start from the highest level and work backwards
    for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (points >= LEVELS[i].pointsRequired) {
            return LEVELS[i].level;
        }
    }
    return 1; // Default to level 1
};

/**
 * Get level data for a specific level number
 */
export const getLevelData = (level: number): Level | undefined => {
    return LEVELS.find(l => l.level === level);
};

/**
 * Update user's level in Firestore based on their points
 */
export const updateUserLevel = async (userId: string, currentPoints: number): Promise<void> => {
    try {
        const newLevel = calculateLevel(currentPoints);
        const userRef = doc(db, 'users', userId);

        await updateDoc(userRef, {
            'stats.level': newLevel,
        });
    } catch (error) {
        console.error('Error updating user level:', error);
    }
};
