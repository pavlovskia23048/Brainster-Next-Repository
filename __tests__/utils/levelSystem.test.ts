// Mock firebase before importing the module
jest.mock('firebase/firestore', () => ({
    doc: jest.fn(),
    updateDoc: jest.fn(),
}));

import { calculateLevel, getLevelData, LEVELS } from '../../utils/levelSystem';

describe('Level System', () => {
    describe('LEVELS', () => {
        it('should have 30 levels', () => {
            expect(LEVELS).toHaveLength(30);
        });

        it('should start at level 1 with 0 points required', () => {
            expect(LEVELS[0].level).toBe(1);
            expect(LEVELS[0].pointsRequired).toBe(0);
            expect(LEVELS[0].name).toBe('Rookie');
            expect(LEVELS[0].tier).toBe('bronze');
        });

        it('should end at level 30 (IMMORTAL) requiring 31000 points', () => {
            const last = LEVELS[LEVELS.length - 1];
            expect(last.level).toBe(30);
            expect(last.pointsRequired).toBe(31000);
            expect(last.name).toBe('IMMORTAL');
            expect(last.tier).toBe('legendary');
        });

        it('should have strictly increasing points requirements', () => {
            for (let i = 1; i < LEVELS.length; i++) {
                expect(LEVELS[i].pointsRequired).toBeGreaterThan(LEVELS[i - 1].pointsRequired);
            }
        });

        it('should have 6 tiers', () => {
            const tiers = new Set(LEVELS.map(l => l.tier));
            expect(tiers.size).toBe(6);
            expect(tiers).toContain('bronze');
            expect(tiers).toContain('silver');
            expect(tiers).toContain('gold');
            expect(tiers).toContain('platinum');
            expect(tiers).toContain('diamond');
            expect(tiers).toContain('legendary');
        });
    });

    describe('calculateLevel', () => {
        it('should return level 1 for 0 points', () => {
            expect(calculateLevel(0)).toBe(1);
        });

        it('should return level 1 for negative points', () => {
            expect(calculateLevel(-10)).toBe(1);
        });

        it('should return level 2 for 50 points', () => {
            expect(calculateLevel(50)).toBe(2);
        });

        it('should return level 2 for 99 points (not yet level 3)', () => {
            expect(calculateLevel(99)).toBe(2);
        });

        it('should return level 3 for exactly 100 points', () => {
            expect(calculateLevel(100)).toBe(3);
        });

        it('should return level 10 for 1600 points', () => {
            expect(calculateLevel(1600)).toBe(10);
        });

        it('should return level 30 for 31000+ points', () => {
            expect(calculateLevel(31000)).toBe(30);
            expect(calculateLevel(50000)).toBe(30);
        });

        it('should handle boundary values correctly', () => {
            // Just below level 6 threshold
            expect(calculateLevel(499)).toBe(5);
            // Exactly at level 6 threshold
            expect(calculateLevel(500)).toBe(6);
        });
    });

    describe('getLevelData', () => {
        it('should return correct data for level 1', () => {
            const data = getLevelData(1);
            expect(data).toBeDefined();
            expect(data!.name).toBe('Rookie');
            expect(data!.tier).toBe('bronze');
            expect(data!.pointsRequired).toBe(0);
        });

        it('should return correct data for level 15', () => {
            const data = getLevelData(15);
            expect(data).toBeDefined();
            expect(data!.name).toBe('Mythic');
            expect(data!.tier).toBe('gold');
        });

        it('should return undefined for non-existent level', () => {
            expect(getLevelData(0)).toBeUndefined();
            expect(getLevelData(31)).toBeUndefined();
        });
    });
});
