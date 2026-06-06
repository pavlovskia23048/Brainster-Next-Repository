"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWorkoutPlan = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const generative_ai_1 = require("@google/generative-ai");
const crypto = __importStar(require("crypto"));
const ai = __importStar(require("./aiTools"));
const MONTHLY_FREE_LIMIT = 3;
function computeCacheKey(contributors) {
    const hash = crypto.createHash("sha256");
    hash.update(JSON.stringify(contributors));
    return hash.digest("hex").substring(0, 16);
}
function validatePlanStructure(plan) {
    if (!plan || typeof plan !== "object")
        return false;
    const p = plan;
    if (!Array.isArray(p.weeklyPlan))
        return false;
    for (const day of p.weeklyPlan) {
        if (!day.day || !day.focus || !Array.isArray(day.exercises))
            return false;
        for (const ex of day.exercises) {
            if (!ex.name || !ex.sets || !ex.reps)
                return false;
        }
    }
    return true;
}
exports.generateWorkoutPlan = (0, https_1.onCall)({
    secrets: ["GEMINI_API_KEY"],
    maxInstances: 10,
    timeoutSeconds: 60,
    cors: [
        /^http:\/\/localhost:\d+$/,
        "https://fitness-ch-hub.web.app",
        "https://fitness-ch-hub.firebaseapp.com",
    ],
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be logged in to generate a plan.");
    }
    const userId = request.auth.uid;
    const payload = request.data;
    const questionnaire = payload?.questionnaire;
    if (!questionnaire || !questionnaire.fitnessGoal || !questionnaire.experienceLevel) {
        throw new https_1.HttpsError("invalid-argument", "Invalid questionnaire data.");
    }
    const db = (0, firestore_1.getFirestore)();
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        throw new https_1.HttpsError("not-found", "User not found.");
    }
    const userData = userDoc.data();
    const subscriptionTier = userData.subscriptionTier || "free";
    const monthlyGenerations = userData.monthlyAiGenerations || 0;
    const lastReset = userData.lastGenerationReset?.toDate() || new Date(0);
    const bodyMetrics = payload.bodyMetrics ?? userData.bodyMetrics ?? undefined;
    const gamificationLevel = payload.gamificationLevel ?? userData.stats?.level ?? 1;
    // Check if monthly counter needs reset (30 days)
    const now = new Date();
    const daysSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24);
    let currentGenerations = monthlyGenerations;
    if (daysSinceReset >= 30) {
        currentGenerations = 0;
        await userRef.update({
            monthlyAiGenerations: 0,
            lastGenerationReset: firestore_1.Timestamp.now(),
        });
    }
    // Check free tier limit
    if (subscriptionTier === "free" && currentGenerations >= MONTHLY_FREE_LIMIT) {
        throw new https_1.HttpsError("resource-exhausted", "You have reached the monthly limit of 3 free AI plan generations. Upgrade to Premium for unlimited access.");
    }
    // Parse injuries + resolve difficulty BEFORE cache key
    const injuryTags = ai.parseInjuries(questionnaire.injuries);
    const difficulty = ai.resolveDifficulty(questionnaire.experienceLevel, gamificationLevel);
    const cacheKey = computeCacheKey(ai.cacheKeyContributors(questionnaire, bodyMetrics, difficulty, injuryTags));
    const thirtyDaysAgo = firestore_1.Timestamp.fromDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    const cachedPlans = await db
        .collection("workoutPlans")
        .where("cacheKey", "==", cacheKey)
        .where("createdAt", ">", thirtyDaysAgo)
        .limit(1)
        .get();
    let weeklyPlan;
    if (!cachedPlans.empty) {
        const cachedPlan = cachedPlans.docs[0].data();
        weeklyPlan = cachedPlan.weeklyPlan;
    }
    else {
        const workoutLogs = await db
            .collection("workoutLogs")
            .where("userId", "==", userId)
            .orderBy("date", "desc")
            .limit(10)
            .get();
        const recentWorkouts = workoutLogs.docs.map((doc) => {
            const data = doc.data();
            return {
                workoutName: data.workoutName || "",
                exercises: (data.exercises || []).map((e) => ({
                    name: e.name || "",
                    sets: Number(e.sets) || 0,
                    reps: Number(e.reps) || 0,
                    weight: Number(e.weight) || 0,
                })),
            };
        });
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new https_1.HttpsError("internal", "AI service is not configured.");
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.7,
                maxOutputTokens: 16384,
            },
        });
        const systemPrompt = ai.buildSystemPrompt();
        const userPrompt = ai.buildUserPrompt(questionnaire, bodyMetrics, recentWorkouts, injuryTags, difficulty, questionnaire.experienceLevel, gamificationLevel);
        const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
        const generateOnce = async () => {
            let result;
            try {
                result = await model.generateContent(fullPrompt);
            }
            catch (error) {
                console.error("Gemini API error:", error);
                throw new https_1.HttpsError("internal", "Failed to generate workout plan. Please try again.");
            }
            const responseText = result.response.text();
            let parsed;
            try {
                parsed = JSON.parse(responseText);
            }
            catch {
                console.error("Failed to parse Gemini response:", responseText);
                throw new https_1.HttpsError("internal", "AI returned an invalid response. Please try again.");
            }
            if (!validatePlanStructure(parsed)) {
                console.error("Invalid plan structure:", parsed);
                throw new https_1.HttpsError("internal", "AI returned an incomplete plan. Please try again.");
            }
            return parsed;
        };
        let plan = await generateOnce();
        let safety = ai.validatePlanSafety(plan, injuryTags);
        if (!safety.ok) {
            console.warn(`Unsafe plan on first attempt for user ${userId}, retrying. Violations:`, JSON.stringify(safety.violations));
            plan = await generateOnce();
            safety = ai.validatePlanSafety(plan, injuryTags);
            if (!safety.ok) {
                console.error(`Unsafe plan after retry for user ${userId}. Violations:`, JSON.stringify(safety.violations));
                throw new https_1.HttpsError("internal", "AI could not produce a safe plan for the given injuries. Please refine your injury description and try again.");
            }
        }
        const weightWarnings = ai.validateWeightFormat(plan);
        if (weightWarnings.length > 0) {
            console.warn(`Weight format warnings for user ${userId}:`, weightWarnings.join("; "));
        }
        weeklyPlan = plan.weeklyPlan;
    }
    // Save plan to Firestore
    const planRef = await db.collection("workoutPlans").add({
        userId,
        createdAt: firestore_1.Timestamp.now(),
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
        lastGenerationReset: daysSinceReset >= 30 ? firestore_1.Timestamp.now() : lastReset,
        aiProfile: questionnaire,
    });
    return {
        planId: planRef.id,
        weeklyPlan,
        resolvedDifficulty: difficulty,
        injuryTags: injuryTags.map((t) => ({ id: t.id, label: t.label })),
    };
});
//# sourceMappingURL=generatePlan.js.map