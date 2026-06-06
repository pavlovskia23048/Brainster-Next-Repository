import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '@/config/firebase';
import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
} from 'firebase/firestore';

export interface Exercise {
    name: string;
    sets: number;
    reps: string;
    weight: string;
    notes: string;
}

export interface DayPlan {
    day: string;
    focus: string;
    exercises: Exercise[];
}

export interface QuestionnaireData {
    fitnessGoal: string;
    experienceLevel: string;
    weeklyFrequency: number;
    availableEquipment: string[];
    injuries: string;
    sessionDuration: number;
}

export interface WorkoutPlan {
    id: string;
    userId: string;
    createdAt: Date;
    questionnaire: QuestionnaireData;
    weeklyPlan: DayPlan[];
    status: 'active' | 'archived';
}

export async function generateWorkoutPlan(questionnaire: QuestionnaireData): Promise<{ planId: string; weeklyPlan: DayPlan[] }> {
    const functions = getFunctions();
    const callable = httpsCallable(functions, 'generateWorkoutPlan');
    const result = await callable({ questionnaire });
    return result.data as { planId: string; weeklyPlan: DayPlan[] };
}

export async function getUserPlans(userId: string): Promise<WorkoutPlan[]> {
    const q = query(
        collection(db, 'workoutPlans'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            userId: data.userId,
            createdAt: data.createdAt?.toDate() || new Date(),
            questionnaire: data.questionnaire,
            weeklyPlan: data.weeklyPlan || [],
            status: data.status || 'active',
        };
    });
}

export async function getPlan(planId: string): Promise<WorkoutPlan | null> {
    const docRef = doc(db, 'workoutPlans', planId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    return {
        id: docSnap.id,
        userId: data.userId,
        createdAt: data.createdAt?.toDate() || new Date(),
        questionnaire: data.questionnaire,
        weeklyPlan: data.weeklyPlan || [],
        status: data.status || 'active',
    };
}

export async function archivePlan(planId: string): Promise<void> {
    await updateDoc(doc(db, 'workoutPlans', planId), { status: 'archived' });
}

export async function deletePlan(planId: string): Promise<void> {
    await deleteDoc(doc(db, 'workoutPlans', planId));
}

export function formatGoal(goal: string): string {
    const map: Record<string, string> = {
        build_muscle: 'Build Muscle',
        lose_weight: 'Lose Weight',
        endurance: 'Improve Endurance',
        maintain: 'Maintain Fitness',
        flexibility: 'Flexibility',
    };
    return map[goal] || goal;
}

export function formatExperience(level: string): string {
    return level.charAt(0).toUpperCase() + level.slice(1);
}
