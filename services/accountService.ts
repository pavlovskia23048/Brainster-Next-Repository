import { auth, db, storage } from '@/config/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    deleteDoc,
    doc,
    writeBatch,
} from 'firebase/firestore';
import { ref, listAll, deleteObject } from 'firebase/storage';
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

async function deleteCollection(collectionName: string, userId: string, fieldName: string = 'userId') {
    const q = query(collection(db, collectionName), where(fieldName, '==', userId));
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    snapshot.docs.forEach(d => {
        batch.delete(d.ref);
    });

    if (snapshot.docs.length > 0) {
        await batch.commit();
    }
}

async function deleteFriendships(userId: string) {
    const q = query(
        collection(db, 'friendships'),
        where('users', 'array-contains', userId)
    );
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    snapshot.docs.forEach(d => {
        batch.delete(d.ref);
    });

    if (snapshot.docs.length > 0) {
        await batch.commit();
    }
}

async function deleteStorageFolder(path: string) {
    try {
        const folderRef = ref(storage, path);
        const result = await listAll(folderRef);

        const deletePromises = result.items.map(item => deleteObject(item));
        await Promise.all(deletePromises);

        // Recurse into subfolders
        for (const prefix of result.prefixes) {
            await deleteStorageFolder(prefix.fullPath);
        }
    } catch {
        // Folder may not exist, ignore
    }
}

export async function reauthenticate(password: string): Promise<void> {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error('No authenticated user');

    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
}

export async function deleteUserAccount(userId: string): Promise<void> {
    // Delete user data from all collections
    await Promise.all([
        deleteCollection('workoutLogs', userId),
        deleteCollection('workoutPlans', userId),
        deleteCollection('measurements', userId),
        deleteCollection('notifications', userId),
        deleteCollection('workoutInvitations', userId, 'fromUserId'),
        deleteCollection('workoutInvitations', userId, 'toUserId'),
        deleteCollection('userAchievements', userId),
        deleteCollection('challengeProgress', userId),
        deleteFriendships(userId),
    ]);

    // Delete storage files
    await Promise.all([
        deleteStorageFolder(`users/${userId}`),
        deleteStorageFolder(`workouts/${userId}`),
        deleteStorageFolder(`progress/${userId}`),
    ]);

    // Delete user document
    await deleteDoc(doc(db, 'users', userId));

    // Delete Firebase Auth account
    const user = auth.currentUser;
    if (user) {
        await deleteUser(user);
    }
}
