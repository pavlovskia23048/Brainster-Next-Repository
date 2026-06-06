jest.mock('firebase/firestore', () => ({
    doc: jest.fn(),
    getDoc: jest.fn(),
    updateDoc: jest.fn(),
    Timestamp: {
        fromDate: jest.fn((date: Date) => ({ toDate: () => date })),
    },
}));

import { getDoc, updateDoc, Timestamp } from 'firebase/firestore';

// Import after mocking
import { getSubscriptionStatus, activateSubscription, cancelSubscription } from '../../services/subscriptionService';

const mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
const mockUpdateDoc = updateDoc as jest.MockedFunction<typeof updateDoc>;

describe('Subscription Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getSubscriptionStatus', () => {
        it('should return free tier defaults when user has no subscription data', async () => {
            mockGetDoc.mockResolvedValueOnce({
                exists: () => true,
                data: () => ({}),
            } as any);

            const status = await getSubscriptionStatus('user-123');

            expect(status.tier).toBe('free');
            expect(status.monthlyGenerationsUsed).toBe(0);
            expect(status.canGenerate).toBe(true);
            expect(status.subscriptionExpiry).toBeNull();
        });

        it('should return free tier defaults when user does not exist', async () => {
            mockGetDoc.mockResolvedValueOnce({
                exists: () => false,
            } as any);

            const status = await getSubscriptionStatus('nonexistent');

            expect(status.tier).toBe('free');
            expect(status.canGenerate).toBe(true);
        });

        it('should allow generation when free user has used fewer than 3', async () => {
            const recentReset = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
            mockGetDoc.mockResolvedValueOnce({
                exists: () => true,
                data: () => ({
                    subscriptionTier: 'free',
                    monthlyAiGenerations: 2,
                    lastGenerationReset: { toDate: () => recentReset },
                }),
            } as any);

            const status = await getSubscriptionStatus('user-123');

            expect(status.tier).toBe('free');
            expect(status.monthlyGenerationsUsed).toBe(2);
            expect(status.canGenerate).toBe(true);
        });

        it('should block generation when free user has used 3 or more', async () => {
            const recentReset = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
            mockGetDoc.mockResolvedValueOnce({
                exists: () => true,
                data: () => ({
                    subscriptionTier: 'free',
                    monthlyAiGenerations: 3,
                    lastGenerationReset: { toDate: () => recentReset },
                }),
            } as any);

            const status = await getSubscriptionStatus('user-123');

            expect(status.canGenerate).toBe(false);
        });

        it('should always allow generation for premium users', async () => {
            const futureExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            mockGetDoc.mockResolvedValueOnce({
                exists: () => true,
                data: () => ({
                    subscriptionTier: 'premium',
                    monthlyAiGenerations: 50,
                    lastGenerationReset: { toDate: () => new Date() },
                    subscriptionExpiry: { toDate: () => futureExpiry },
                }),
            } as any);

            const status = await getSubscriptionStatus('user-123');

            expect(status.tier).toBe('premium');
            expect(status.canGenerate).toBe(true);
        });

        it('should reset counter when 30+ days have passed', async () => {
            const oldReset = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000); // 35 days ago
            mockGetDoc.mockResolvedValueOnce({
                exists: () => true,
                data: () => ({
                    subscriptionTier: 'free',
                    monthlyAiGenerations: 3,
                    lastGenerationReset: { toDate: () => oldReset },
                }),
            } as any);

            const status = await getSubscriptionStatus('user-123');

            expect(status.monthlyGenerationsUsed).toBe(0);
            expect(status.canGenerate).toBe(true);
        });

        it('should treat expired premium as free tier', async () => {
            const expiredDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
            mockGetDoc.mockResolvedValueOnce({
                exists: () => true,
                data: () => ({
                    subscriptionTier: 'premium',
                    monthlyAiGenerations: 3,
                    lastGenerationReset: { toDate: () => new Date() },
                    subscriptionExpiry: { toDate: () => expiredDate },
                }),
            } as any);

            const status = await getSubscriptionStatus('user-123');

            expect(status.tier).toBe('free');
            expect(status.canGenerate).toBe(false);
        });
    });

    describe('activateSubscription', () => {
        it('should set monthly subscription expiry to ~30 days from now', async () => {
            mockUpdateDoc.mockResolvedValueOnce(undefined);

            await activateSubscription('user-123', 'monthly');

            expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
            const updateCall = mockUpdateDoc.mock.calls[0];
            expect(updateCall[1]).toEqual(
                expect.objectContaining({
                    subscriptionTier: 'premium',
                })
            );
        });

        it('should set yearly subscription expiry to ~365 days from now', async () => {
            mockUpdateDoc.mockResolvedValueOnce(undefined);

            await activateSubscription('user-123', 'yearly');

            expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
            const updateCall = mockUpdateDoc.mock.calls[0];
            expect(updateCall[1].subscriptionTier).toBe('premium');
        });
    });

    describe('cancelSubscription', () => {
        it('should set tier back to free and clear expiry', async () => {
            mockUpdateDoc.mockResolvedValueOnce(undefined);

            await cancelSubscription('user-123');

            expect(mockUpdateDoc).toHaveBeenCalledWith(
                expect.anything(),
                { subscriptionTier: 'free', subscriptionExpiry: null }
            );
        });
    });
});
