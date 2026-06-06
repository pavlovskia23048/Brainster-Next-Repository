import { create } from 'zustand';

interface SubscriptionState {
    tier: 'free' | 'premium';
    monthlyGenerationsUsed: number;
    monthlyGenerationsLimit: number;
    subscriptionExpiry: Date | null;
    isLoading: boolean;

    setSubscription: (tier: 'free' | 'premium', expiry?: Date | null) => void;
    setGenerationsUsed: (count: number) => void;
    reset: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>()((set) => ({
    tier: 'free',
    monthlyGenerationsUsed: 0,
    monthlyGenerationsLimit: 3,
    subscriptionExpiry: null,
    isLoading: false,

    setSubscription: (tier, expiry = null) =>
        set({
            tier,
            subscriptionExpiry: expiry,
            monthlyGenerationsLimit: tier === 'premium' ? Infinity : 3,
        }),

    setGenerationsUsed: (count) =>
        set({ monthlyGenerationsUsed: count }),

    reset: () =>
        set({
            tier: 'free',
            monthlyGenerationsUsed: 0,
            monthlyGenerationsLimit: 3,
            subscriptionExpiry: null,
        }),
}));
