import { db } from '@/config/firebase';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';

export interface SubscriptionStatus {
    tier: 'free' | 'premium';
    monthlyGenerationsUsed: number;
    subscriptionExpiry: Date | null;
    canGenerate: boolean;
}

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (!userDoc.exists()) {
        return { tier: 'free', monthlyGenerationsUsed: 0, subscriptionExpiry: null, canGenerate: true };
    }

    const data = userDoc.data();
    const tier = data.subscriptionTier || 'free';
    const generations = data.monthlyAiGenerations || 0;
    const lastReset = data.lastGenerationReset?.toDate() || new Date(0);
    const expiry = data.subscriptionExpiry?.toDate() || null;

    // Check if monthly counter needs reset
    const daysSinceReset = (Date.now() - lastReset.getTime()) / (1000 * 60 * 60 * 24);
    const currentGenerations = daysSinceReset >= 30 ? 0 : generations;

    // Check if premium subscription has expired
    const effectiveTier = (tier === 'premium' && expiry && expiry < new Date()) ? 'free' : tier;

    const canGenerate = effectiveTier === 'premium' || currentGenerations < 3;

    return {
        tier: effectiveTier,
        monthlyGenerationsUsed: currentGenerations,
        subscriptionExpiry: expiry,
        canGenerate,
    };
}

export async function activateSubscription(
    userId: string,
    plan: 'monthly' | 'yearly'
): Promise<void> {
    const now = new Date();
    const expiry = new Date(now);

    if (plan === 'monthly') {
        expiry.setMonth(expiry.getMonth() + 1);
    } else {
        expiry.setFullYear(expiry.getFullYear() + 1);
    }

    await updateDoc(doc(db, 'users', userId), {
        subscriptionTier: 'premium',
        subscriptionExpiry: Timestamp.fromDate(expiry),
    });
}

export async function cancelSubscription(userId: string): Promise<void> {
    await updateDoc(doc(db, 'users', userId), {
        subscriptionTier: 'free',
        subscriptionExpiry: null,
    });
}

// Demo/testing helpers
export async function resetGenerationCounter(userId: string): Promise<void> {
    await updateDoc(doc(db, 'users', userId), {
        monthlyAiGenerations: 0,
        lastGenerationReset: Timestamp.fromDate(new Date()),
    });
}

export async function simulateGenerationsUsed(userId: string, count: number): Promise<void> {
    await updateDoc(doc(db, 'users', userId), {
        monthlyAiGenerations: count,
        lastGenerationReset: Timestamp.fromDate(new Date()),
    });
}

export async function resetToFree(userId: string): Promise<void> {
    await updateDoc(doc(db, 'users', userId), {
        subscriptionTier: 'free',
        subscriptionExpiry: null,
        monthlyAiGenerations: 0,
        lastGenerationReset: Timestamp.fromDate(new Date()),
    });
}
