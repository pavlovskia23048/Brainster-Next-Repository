// Mock Firebase
jest.mock('@/config/firebase', () => ({
    auth: {
        currentUser: { uid: 'test-user-123', email: 'test@example.com' },
        onAuthStateChanged: jest.fn(),
    },
    db: {},
    storage: {},
    functions: {},
}));

// Mock expo modules
jest.mock('expo-notifications', () => ({
    scheduleNotificationAsync: jest.fn(),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    setNotificationHandler: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));
