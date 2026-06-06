import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as crypto from "crypto";
import * as ai from "./aiTools";

interface RequestPayload {
    questionnaire: ai.QuestionnaireData;
    bodyMetrics?: ai.BodyMetrics;
    gamificationLevel?: number;
}

const MONTHLY_FREE_LIMIT = 3;

function computeCacheKey(contributors: Record<string, unknown>): string {
    const hash = crypto.createHash("sha256");
    hash.update(JSON.stringify(contributors));
    return hash.digest("hex").substring(0, 16);
}

function validatePlanStructure(plan: unknown): plan is ai.WorkoutPlan {
    if (!plan || typeof plan !== "object") return false;
    const p = plan as Record<string, unknown>;
    if (!Array.isArray(p.weeklyPlan)) return false;

    for (const day of p.weeklyPlan) {
        if (!day.day || !day.focus || !Array.isArray(day.exercises)) return false;
        for (const ex of day.exercises) {
            if (!ex.name || !ex.sets || !ex.reps) return false;
        }
    }
    return true;
}

export const generateWorkoutPlan = onCall(
    {
        secrets: ["GEMINI_API_KEY"],
        maxInstances: 10,
        timeoutSeconds: 60,
        cors: [
            /^http:\/\/localhost:\d+$/,
            "https://fitness-ch-hub.web.app",
            "https://fitness-ch-hub.firebaseapp.com",
        ],
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "You must be logged in to generate a plan.");
        }

        const userId = request.auth.uid;
        const payload = request.data as RequestPayload;
        const questionnaire = payload?.questionnaire;

        if (!questionnaire || !questionnaire.fitnessGoal || !questionnaire.experienceLevel) {
            throw new HttpsError("invalid-argument", "Invalid questionnaire data.");
        }

        const db = getFirestore();
        const userRef = db.collection("users").doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            throw new HttpsError("not-found", "User not found.");
        }

        const userData = userDoc.data()!;
        const subscriptionTier = userData.subscriptionTier || "free";
        const monthlyGenerations = userData.monthlyAiGenerations || 0;
        const lastReset = userData.lastGenerationReset?.toDate() || new Date(0);

        const bodyMetrics: ai.BodyMetrics | undefined =
            payload.bodyMetrics ?? userData.bodyMetrics ?? undefined;
        const gamificationLevel: number =
            payload.gamificationLevel ?? userData.stats?.level ?? 1;

        // Check if monthly counter needs reset (30 days)
        const now = new Date();
        const daysSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24);
        let currentGenerations = monthlyGenerations;

        if (daysSinceReset >= 30) {
            currentGenerations = 0;
            await userRef.update({
                monthlyAiGenerations: 0,
                lastGenerationReset: Timestamp.now(),
            });
        }

        // Check free tier limit
        if (subscriptionTier === "free" && currentGenerations >= MONTHLY_FREE_LIMIT) {
            throw new HttpsError(
                "resource-exhausted",
                "You have reached the monthly limit of 3 free AI plan generations. Upgrade to Premium for unlimited access."
            );
        }

        // Parse injuries + resolve difficulty BEFORE cache key
        const injuryTags = ai.parseInjuries(questionnaire.injuries);
        const difficulty = ai.resolveDifficulty(
            questionnaire.experienceLevel,
            gamificationLevel
        );

        const cacheKey = computeCacheKey(
            ai.cacheKeyContributors(questionnaire, bodyMetrics, difficulty, injuryTags)
        );
        const thirtyDaysAgo = Timestamp.fromDate(
            new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        );

        const cachedPlans = await db
            .collection("workoutPlans")
            .where("cacheKey", "==", cacheKey)
            .where("createdAt", ">", thirtyDaysAgo)
            .limit(1)
            .get();

        let weeklyPlan: ai.DayPlan[];

        if (!cachedPlans.empty) {
            const cachedPlan = cachedPlans.docs[0].data();
            weeklyPlan = cachedPlan.weeklyPlan;
        } else {
            const workoutLogs = await db
                .collection("workoutLogs")
                .where("userId", "==", userId)
                .orderBy("date", "desc")
                .limit(10)
                .get();

            const recentWorkouts: ai.RecentWorkout[] = workoutLogs.docs.map((doc) => {
                const data = doc.data();
                return {
                    workoutName: data.workoutName || "",
                    exercises: (data.exercises || []).map((e: Record<string, unknown>) => ({
                        name: (e.name as string) || "",
                        sets: Number(e.sets) || 0,
                        reps: Number(e.reps) || 0,
                        weight: Number(e.weight) || 0,
                    })),
                };
            });

            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                throw new HttpsError("internal", "AI service is not configured.");
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.7,
                    maxOutputTokens: 16384,
                },
            });

            const systemPrompt = ai.buildSystemPrompt();
            const userPrompt = ai.buildUserPrompt(
                questionnaire,
                bodyMetrics,
                recentWorkouts,
                injuryTags,
                difficulty,
                questionnaire.experienceLevel,
                gamificationLevel
            );
            const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

            const generateOnce = async (): Promise<ai.WorkoutPlan> => {
                let result;
                try {
                    result = await model.generateContent(fullPrompt);
                } catch (error) {
                    console.error("Gemini API error:", error);
                    throw new HttpsError("internal", "Failed to generate workout plan. Please try again.");
                }
                const responseText = result.response.text();
                let parsed: unknown;
                try {
                    parsed = JSON.parse(responseText);
                } catch {
                    console.error("Failed to parse Gemini response:", responseText);
                    throw new HttpsError("internal", "AI returned an invalid response. Please try again.");
                }
                if (!validatePlanStructure(parsed)) {
                    console.error("Invalid plan structure:", parsed);
                    throw new HttpsError("internal", "AI returned an incomplete plan. Please try again.");
                }
                return parsed as ai.WorkoutPlan;
            };

            let plan = await generateOnce();
            let safety = ai.validatePlanSafety(plan, injuryTags);

            if (!safety.ok) {
                console.warn(
                    `Unsafe plan on first attempt for user ${userId}, retrying. Violations:`,
                    JSON.stringify(safety.violations)
                );
                plan = await generateOnce();
                safety = ai.validatePlanSafety(plan, injuryTags);
                if (!safety.ok) {
                    console.error(
                        `Unsafe plan after retry for user ${userId}. Violations:`,
                        JSON.stringify(safety.violations)
                    );
                    throw new HttpsError(
                        "internal",
                        "AI could not produce a safe plan for the given injuries. Please refine your injury description and try again."
                    );
                }
            }

            const weightWarnings = ai.validateWeightFormat(plan);
            if (weightWarnings.length > 0) {
                console.warn(
                    `Weight format warnings for user ${userId}:`,
                    weightWarnings.join("; ")
                );
            }

            weeklyPlan = plan.weeklyPlan;
        }

        // Save plan to Firestore
        const planRef = await db.collection("workoutPlans").add({
            userId,
            createdAt: Timestamp.now(),
            questionnaire,
            bodyMetrics: bodyMetrics ?? null,
            gamificationLevel,
            resolvedDifficulty: difficulty,
            injuryTagIds: injuryTags.map((t) => t.id),
            cacheKey,
            weeklyPlan,
            status: "active",
        });

        await userRef.update({
            monthlyAiGenerations: currentGenerations + 1,
            lastGenerationReset: daysSinceReset >= 30 ? Timestamp.now() : lastReset,
            aiProfile: questionnaire,
        });

        return {
            planId: planRef.id,
            weeklyPlan,
            resolvedDifficulty: difficulty,
            injuryTags: injuryTags.map((t) => ({ id: t.id, label: t.label })),
        };
    }
);
