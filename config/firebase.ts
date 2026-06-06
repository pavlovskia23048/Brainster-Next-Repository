import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getAuth, getReactNativePersistence, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFunctions, Functions } from "firebase/functions";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const nativeConfig = {
  apiKey: "AIzaSyAgGses6zD3OPnOz8QlpdlHwvMphhV3IlA",
  authDomain: "fitness-ch-hub.firebaseapp.com",
  projectId: "fitness-ch-hub",
  storageBucket: "fitness-ch-hub.firebasestorage.app",
  messagingSenderId: "553118533274",
  appId: "1:553118533274:android:dfd7519165851f5aff8123"
};

const webConfig = {
  apiKey: "AIzaSyDyqz8jfeTCxUAU5UUGEdfnVb7K0ejn8d0",
  authDomain: "fitness-ch-hub.firebaseapp.com",
  projectId: "fitness-ch-hub",
  storageBucket: "fitness-ch-hub.firebasestorage.app",
  messagingSenderId: "553118533274",
  appId: "1:553118533274:web:8ed4130667981105ff8123"
};

const firebaseConfig = Platform.OS === 'web' ? webConfig : nativeConfig;

let app;
if (!getApps().length) {
  try {
    console.log("Initializing Firebase...");
    app = initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully");
  } catch (error) {
    console.error("Error initializing Firebase:", error);
    throw error;
  }
} else {
  app = getApp();
  console.log("Using existing Firebase app");
}

let auth: Auth, db: Firestore, storage: FirebaseStorage;
try {
  // Try to get existing auth instance first
  auth = getAuth(app);
  console.log("Using existing Firebase Auth instance");
} catch {
  try {
    // Initialize Auth with AsyncStorage persistence for React Native
    console.log("Initializing Firebase Auth with AsyncStorage persistence...");
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
    console.log("Firebase Auth initialized successfully with persistence");
  } catch (error) {
    console.error("Error initializing Firebase Auth:", error);
    // Fallback to default auth
    auth = getAuth(app);
  }
}

// Initialize Firestore, Storage, and Functions
let functions: Functions;
try {
  db = getFirestore(app);
  storage = getStorage(app);
  functions = getFunctions(app);
  console.log("Firestore, Storage, and Functions initialized successfully");
} catch (error) {
  console.error("Error initializing Firestore/Storage/Functions:", error);
  throw error;
}

export { auth, db, storage, functions };
export default app;
