/**
 * AI Tools — reinforcement-prompt + safety layer for workout generation.
 *
 * Responsibilities:
 *   1. Parse free-text injuries into structured tags.
 *   2. Resolve a single difficulty from questionnaire self-assessment +
 *      gamification level derived from real workout history.
 *   3. Build a constitution-style system prompt with hard safety rules.
 *   4. Inject per-injury reinforcement (FORBIDDEN / USE INSTEAD) into the
 *      user prompt so the model can't ignore the user's limitations.
 *   5. Validate the generated plan against the active injuries, so a
 *      forbidden exercise never reaches the user even if the model slips.
 */

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type Sex = "male" | "female" | "other";

export interface BodyMetrics {
    heightCm?: number | null;
    weightKg?: number | null;
    age?: number | null;
    sex?: Sex | null;
}

export interface InjuryRule {
    label: string;
    bodyParts: string[];
    forbiddenExercises: string[];
    safeAlternatives: string[];
    severity: "mild" | "severe";
    keywords: string[];
}

export interface InjuryTag {
    id: string;
    label: string;
    bodyParts: string[];
    forbiddenExercises: string[];
    safeAlternatives: string[];
    severity: "mild" | "severe";
}

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

export interface WorkoutPlan {
    weeklyPlan: DayPlan[];
}

export interface QuestionnaireData {
    fitnessGoal: string;
    experienceLevel: string;
    weeklyFrequency: number;
    availableEquipment: string[];
    injuries: string;
    sessionDuration: number;
}

export interface RecentWorkout {
    workoutName: string;
    exercises: Array<{ name: string; sets: number; reps: number; weight: number }>;
}

// ---------------------------------------------------------------------------
// Injury map — central registry of recognised injuries with mappings to
// forbidden exercises (substring match, lowercase) and safe alternatives.
// Synonyms include English plus common Macedonian/Cyrillic transliterations.
// ---------------------------------------------------------------------------

export const INJURY_MAP: Record<string, InjuryRule> = {
    lower_back: {
        label: "Lower back",
        bodyParts: ["lower_back", "spine", "lumbar"],
        forbiddenExercises: [
            "deadlift",
            "romanian deadlift",
            "stiff leg deadlift",
            "back squat",
            "front squat",
            "barbell squat",
            "good morning",
            "bent over row",
            "barbell row",
            "pendlay row",
            "overhead press",
            "barbell shrug",
            "hyperextension",
            "russian twist",
            "weighted sit up",
        ],
        safeAlternatives: [
            "glute bridge",
            "hip thrust (machine, supported)",
            "bird dog",
            "swimmer",
            "cable pull-through (light)",
            "dead bug",
            "seated leg curl",
            "leg press (light, neutral spine)",
        ],
        severity: "severe",
        keywords: [
            "lower back",
            "lower-back",
            "lumbar",
            "lumbago",
            "low back",
            "lower spine",
            "крст",
            "kr'st",
            "krst",
            "donji deo ledja",
            "доњи дел грб",
            "грб болка",
        ],
    },
    upper_back: {
        label: "Upper back / neck",
        bodyParts: ["upper_back", "trapezius", "neck"],
        forbiddenExercises: [
            "barbell shrug",
            "behind the neck press",
            "behind-the-neck pulldown",
            "upright row",
            "heavy farmers carry",
            "neck bridge",
        ],
        safeAlternatives: [
            "scapular pull-up",
            "face pull (light)",
            "band pull-apart",
            "prone Y raise",
            "cable row (neutral grip)",
        ],
        severity: "mild",
        keywords: [
            "upper back",
            "trapezius",
            "trap pain",
            "neck",
            "cervical",
            "врат",
            "vrat",
            "горен грб",
        ],
    },
    knee: {
        label: "Knee",
        bodyParts: ["knee", "patella", "meniscus", "acl", "mcl"],
        forbiddenExercises: [
            "barbell squat",
            "back squat",
            "front squat",
            "jumping squat",
            "jump squat",
            "box jump",
            "lunge",
            "walking lunge",
            "bulgarian split squat",
            "pistol squat",
            "leg extension (heavy)",
            "deep leg press",
            "burpee",
            "running",
            "sprint",
            "high knee",
            "plyometric",
        ],
        safeAlternatives: [
            "seated leg curl (light)",
            "glute bridge",
            "hip thrust (machine)",
            "wall sit (shallow)",
            "swimming",
            "cycling (low resistance)",
            "step-up (low box, controlled)",
            "single-leg romanian deadlift (bodyweight, no knee bend stress)",
        ],
        severity: "severe",
        keywords: [
            "knee",
            "knees",
            "patella",
            "meniscus",
            "acl",
            "mcl",
            "колено",
            "koleno",
            "koleni",
        ],
    },
    shoulder: {
        label: "Shoulder",
        bodyParts: ["shoulder", "deltoid", "rotator_cuff", "ac_joint"],
        forbiddenExercises: [
            "overhead press",
            "military press",
            "behind the neck press",
            "behind-the-neck pulldown",
            "upright row",
            "snatch",
            "clean and jerk",
            "dips",
            "wide grip bench press",
            "lateral raise (heavy)",
            "front raise (heavy)",
            "barbell shrug",
            "kipping pull-up",
        ],
        safeAlternatives: [
            "neutral grip dumbbell press (light)",
            "landmine press",
            "cable row (neutral grip)",
            "scapular pull-up",
            "face pull (light)",
            "band external rotation",
            "wall slide",
        ],
        severity: "severe",
        keywords: [
            "shoulder",
            "shoulders",
            "rotator cuff",
            "rotator-cuff",
            "deltoid",
            "ac joint",
            "ac-joint",
            "раме",
            "rame",
            "ramo",
        ],
    },
    wrist: {
        label: "Wrist",
        bodyParts: ["wrist", "forearm"],
        forbiddenExercises: [
            "barbell curl",
            "wrist curl",
            "reverse curl",
            "front squat (clean grip)",
            "handstand push-up",
            "kettlebell snatch",
            "kettlebell clean",
            "push-up (flat)",
            "plank (on hands)",
        ],
        safeAlternatives: [
            "dumbbell curl (neutral grip)",
            "hammer curl",
            "push-up (on fists or push-up handles)",
            "forearm plank",
            "cable curl with strap",
            "machine chest press",
        ],
        severity: "mild",
        keywords: [
            "wrist",
            "wrists",
            "forearm",
            "carpal",
            "рачен зглоб",
            "racen zglob",
            "raka zglob",
        ],
    },
    elbow: {
        label: "Elbow",
        bodyParts: ["elbow", "tricep_tendon", "tennis_elbow", "golfers_elbow"],
        forbiddenExercises: [
            "barbell curl",
            "skull crusher",
            "lying triceps extension",
            "close grip bench press",
            "weighted dips",
            "chin-up (heavy)",
            "kipping pull-up",
        ],
        safeAlternatives: [
            "cable curl (light)",
            "hammer curl (light)",
            "machine triceps pushdown (light, neutral grip)",
            "machine row",
            "lat pulldown (wide grip)",
        ],
        severity: "mild",
        keywords: [
            "elbow",
            "elbows",
            "tennis elbow",
            "golfer's elbow",
            "tendonitis",
            "лакт",
            "lakot",
        ],
    },
    hip: {
        label: "Hip",
        bodyParts: ["hip", "hip_flexor", "groin"],
        forbiddenExercises: [
            "barbell squat",
            "front squat",
            "deep lunge",
            "side lunge",
            "sumo deadlift",
            "wide stance squat",
            "leg raise (hanging)",
            "scissor kick",
            "v-up",
        ],
        safeAlternatives: [
            "glute bridge (controlled ROM)",
            "clamshell",
            "side-lying leg raise",
            "cable kickback (light)",
            "seated leg curl",
            "machine adduction (light)",
        ],
        severity: "severe",
        keywords: [
            "hip",
            "hips",
            "hip flexor",
            "groin",
            "колк",
            "kolk",
        ],
    },
    ankle: {
        label: "Ankle",
        bodyParts: ["ankle", "calf", "achilles"],
        forbiddenExercises: [
            "box jump",
            "jump squat",
            "burpee",
            "jumping lunge",
            "running",
            "sprint",
            "calf raise (loaded heavy)",
            "single-leg jump",
            "depth jump",
        ],
        safeAlternatives: [
            "seated calf raise (light)",
            "cycling (low resistance)",
            "swimming",
            "machine leg press (light, partial ROM)",
            "glute bridge",
        ],
        severity: "severe",
        keywords: [
            "ankle",
            "ankles",
            "achilles",
            "calf strain",
            "глужд",
            "gluzd",
            "skocni",
        ],
    },
};

// ---------------------------------------------------------------------------
// Injury parsing
// ---------------------------------------------------------------------------

export function parseInjuries(freeText: string | undefined | null): InjuryTag[] {
    if (!freeText || typeof freeText !== "string") return [];
    const text = freeText.toLowerCase();
    const matched = new Set<string>();
    const tags: InjuryTag[] = [];

    for (const [id, rule] of Object.entries(INJURY_MAP)) {
        if (matched.has(id)) continue;
        for (const keyword of rule.keywords) {
            if (text.includes(keyword.toLowerCase())) {
                matched.add(id);
                tags.push({
                    id,
                    label: rule.label,
                    bodyParts: rule.bodyParts,
                    forbiddenExercises: rule.forbiddenExercises,
                    safeAlternatives: rule.safeAlternatives,
                    severity: rule.severity,
                });
                break;
            }
        }
    }

    return tags;
}

// ---------------------------------------------------------------------------
// Difficulty resolution — combine self-assessment with gamification level
// ---------------------------------------------------------------------------

export function resolveDifficulty(
    questionnaireLevel: string,
    gamificationLevel: number | undefined | null
): Difficulty {
    const self = normalizeLevel(questionnaireLevel);
    const lvl = typeof gamificationLevel === "number" ? gamificationLevel : 1;

    if (self === "beginner" && lvl >= 11) return "intermediate";
    if (self === "intermediate" && lvl >= 21) return "advanced";
    if (self === "advanced" && lvl <= 5) return "intermediate";
    return self;
}

function normalizeLevel(s: string): Difficulty {
    const v = (s || "").toLowerCase();
    if (v.startsWith("adv")) return "advanced";
    if (v.startsWith("int")) return "intermediate";
    return "beginner";
}

// ---------------------------------------------------------------------------
// Weight guidance — translate bodyweight × difficulty to concrete kg targets
// ---------------------------------------------------------------------------

const WEIGHT_MULTIPLIERS: Record<
    Difficulty,
    Record<string, number>
> = {
    beginner: {
        bench_press: 0.4,
        back_squat: 0.5,
        deadlift: 0.6,
        overhead_press: 0.25,
        barbell_row: 0.4,
        dumbbell_curl_per_hand: 0.07,
    },
    intermediate: {
        bench_press: 0.6,
        back_squat: 0.8,
        deadlift: 1.0,
        overhead_press: 0.4,
        barbell_row: 0.6,
        dumbbell_curl_per_hand: 0.12,
    },
    advanced: {
        bench_press: 0.8,
        back_squat: 1.1,
        deadlift: 1.4,
        overhead_press: 0.55,
        barbell_row: 0.85,
        dumbbell_curl_per_hand: 0.17,
    },
};

export function buildWeightGuidance(
    metrics: BodyMetrics | undefined,
    difficulty: Difficulty,
    sex?: Sex
): string {
    const bw = metrics?.weightKg;
    if (!bw || bw < 30 || bw > 300) {
        return [
            "WEIGHT GUIDANCE:",
            "- Bodyweight unknown. Use generic ranges per experience level.",
            "- Beginner compound lifts: light, focus on form (use bands or dumbbells under 15kg).",
            "- Intermediate compound lifts: moderate (20-40kg dumbbells, 30-60kg barbell).",
            "- Advanced compound lifts: heavy (40+kg dumbbells, 60-100kg barbell).",
            "- For accessory work specify a dumbbell weight in kg.",
        ].join("\n");
    }

    const m = WEIGHT_MULTIPLIERS[difficulty];
    const sexAdjust = sex === "female" ? 0.85 : 1.0;
    const round = (n: number) => Math.max(2.5, Math.round((n / 2.5)) * 2.5);

    const benchKg = round(bw * m.bench_press * sexAdjust);
    const squatKg = round(bw * m.back_squat * sexAdjust);
    const dlKg = round(bw * m.deadlift * sexAdjust);
    const ohpKg = round(bw * m.overhead_press * sexAdjust);
    const rowKg = round(bw * m.barbell_row * sexAdjust);
    const curlKg = round(bw * m.dumbbell_curl_per_hand * sexAdjust);

    const lines = [
        `WEIGHT GUIDANCE (starting loads for a ${bw}kg ${difficulty} trainee${sex ? `, ${sex}` : ""}):`,
        `- Bench press:        ~${benchKg}kg (barbell, working set)`,
        `- Squat (back/front): ~${squatKg}kg (barbell, working set)`,
        `- Deadlift:           ~${dlKg}kg (barbell, working set)`,
        `- Overhead press:     ~${ohpKg}kg (barbell)`,
        `- Barbell row:        ~${rowKg}kg`,
        `- Dumbbell curl:      ~${curlKg}kg per hand`,
        `- Dumbbell shoulder press: ~${round(curlKg * 2.5)}kg per hand`,
        `- Bodyweight movements (push-up, pull-up, plank): use "bodyweight" as the weight string.`,
        `- For machines, prescribe a concrete kg value in the same range as the equivalent barbell lift.`,
        `- For unilateral or accessory lifts, scale to 40-60% of the matching compound lift.`,
    ];

    if (difficulty === "beginner") {
        lines.push(`- Beginner cap: NO compound lift above ${round(bw * 0.5)}kg (50% bodyweight) without progression history.`);
    }

    return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Injury reinforcement block — printed verbatim in the user prompt so the
// model encounters it on each generation.
// ---------------------------------------------------------------------------

export function buildInjuryReinforcement(tags: InjuryTag[]): string {
    if (tags.length === 0) return "";

    const lines: string[] = [
        "",
        "INJURY REINFORCEMENT — HARD CONSTRAINTS:",
        "You MUST avoid every exercise listed under FORBIDDEN. If a similar",
        "exercise comes to mind, prefer the corresponding SAFE ALTERNATIVES.",
        "Do not propose any variant of a forbidden exercise (e.g. a 'safer'",
        "version of a back squat is still a back squat for our purposes).",
        "",
    ];

    for (const tag of tags) {
        lines.push(`⚠ INJURY: ${tag.label} (severity: ${tag.severity})`);
        lines.push(`  AFFECTED BODY PARTS: ${tag.bodyParts.join(", ")}`);
        lines.push(`  FORBIDDEN: ${tag.forbiddenExercises.join(", ")}`);
        lines.push(`  SAFE ALTERNATIVES: ${tag.safeAlternatives.join(", ")}`);
        lines.push("");
    }

    return lines.join("\n");
}

// ---------------------------------------------------------------------------
// System prompt — constitution. Numbered, terse, hard rules.
// ---------------------------------------------------------------------------

export function buildSystemPrompt(): string {
    return [
        "You are a certified personal trainer AI generating safe, personalized",
        "weekly workout plans. You MUST follow these rules in order of priority:",
        "",
        "1. SAFETY FIRST. Never prescribe an exercise listed under FORBIDDEN in",
        "   the INJURY REINFORCEMENT block. This rule overrides every other goal.",
        "2. When an injury is present, prefer the SAFE ALTERNATIVES provided",
        "   for the affected body parts.",
        "3. All weight values MUST be numeric in kilograms with the suffix 'kg'",
        "   (e.g. '40kg', '12.5kg dumbbells'). For bodyweight-only movements use",
        "   the literal string 'bodyweight'. NEVER use vague words like",
        "   'moderate', 'light', 'heavy', or 'N/A' as the weight value.",
        "4. Calibrate every loaded lift to the user's WEIGHT GUIDANCE block.",
        "5. If the resolved difficulty is 'beginner', do not exceed",
        "   0.5×bodyweight on any compound barbell lift.",
        "6. Honor the requested weekly frequency exactly. Each training day must",
        "   contain 4-6 exercises sized to fit the requested session duration.",
        "7. Return VALID JSON only. No prose, no markdown fences, no commentary",
        "   outside the JSON document.",
    ].join("\n");
}

// ---------------------------------------------------------------------------
// User prompt — full context built from questionnaire + profile + history.
// ---------------------------------------------------------------------------

export function buildUserPrompt(
    questionnaire: QuestionnaireData,
    metrics: BodyMetrics | undefined,
    recentWorkouts: RecentWorkout[],
    injuryTags: InjuryTag[],
    difficulty: Difficulty,
    questionnaireLevelRaw: string,
    gamificationLevel: number | undefined
): string {
    const parts: string[] = [];

    parts.push("USER PROFILE:");
    parts.push(`- Fitness Goal: ${questionnaire.fitnessGoal.replace(/_/g, " ")}`);
    parts.push(`- Self-Reported Experience: ${questionnaireLevelRaw}`);
    parts.push(`- Gamification Level (from real workout history): ${gamificationLevel ?? "n/a"}`);
    parts.push(`- Training Frequency: ${questionnaire.weeklyFrequency} days/week`);
    parts.push(`- Session Duration: ${questionnaire.sessionDuration} minutes`);
    parts.push(`- Available Equipment: ${questionnaire.availableEquipment.join(", ") || "bodyweight only"}`);

    if (metrics) {
        const hm = metrics.heightCm ? `${metrics.heightCm}cm` : "n/a";
        const wm = metrics.weightKg ? `${metrics.weightKg}kg` : "n/a";
        const am = metrics.age ? `${metrics.age} years` : "n/a";
        const sx = metrics.sex ?? "n/a";
        parts.push(`- Height: ${hm}, Weight: ${wm}, Age: ${am}, Sex: ${sx}`);
    } else {
        parts.push("- Body metrics: not provided (use generic ranges)");
    }

    parts.push("");
    parts.push(`RESOLVED DIFFICULTY: ${difficulty}`);
    parts.push(`(derived by combining self-reported '${questionnaireLevelRaw}' with gamification level ${gamificationLevel ?? "n/a"})`);

    parts.push("");
    parts.push(buildWeightGuidance(metrics, difficulty, metrics?.sex ?? undefined));

    const reinforcement = buildInjuryReinforcement(injuryTags);
    if (reinforcement) {
        parts.push(reinforcement);
    } else if (questionnaire.injuries && questionnaire.injuries.trim().length > 0) {
        parts.push("");
        parts.push("USER-REPORTED LIMITATIONS (no structured rule matched — read carefully and avoid stressing the named area):");
        parts.push(`  "${questionnaire.injuries.trim()}"`);
    }

    if (recentWorkouts.length > 0) {
        parts.push("");
        parts.push("RECENT WORKOUT HISTORY (most recent first, for progressive overload context):");
        for (const w of recentWorkouts.slice(0, 5)) {
            const ex = w.exercises
                .map((e) => `${e.name} (${e.sets}×${e.reps} @ ${e.weight}kg)`)
                .join(", ");
            parts.push(`- ${w.workoutName}: ${ex}`);
        }
    }

    parts.push("");
    parts.push(`TASK: Generate exactly ${questionnaire.weeklyFrequency} training days with 4-6 exercises each, appropriate for ${difficulty} level. Include rest days between hard sessions when the frequency allows.`);
    parts.push("");
    parts.push("OUTPUT FORMAT — return ONLY this JSON, no prose:");
    parts.push(`{
  "weeklyPlan": [
    {
      "day": "Monday",
      "focus": "Upper Body Push",
      "exercises": [
        {
          "name": "Dumbbell Bench Press",
          "sets": 4,
          "reps": "8-10",
          "weight": "20kg",
          "notes": "Focus on controlled descent. Rest 90s between sets."
        }
      ]
    }
  ]
}`);

    return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Post-generation safety validation
// ---------------------------------------------------------------------------

export interface SafetyViolation {
    day: string;
    exercise: string;
    reason: string;
    injuryId: string;
}

export interface SafetyResult {
    ok: boolean;
    violations: SafetyViolation[];
}

export function validatePlanSafety(
    plan: WorkoutPlan,
    injuryTags: InjuryTag[]
): SafetyResult {
    if (injuryTags.length === 0) return { ok: true, violations: [] };

    const violations: SafetyViolation[] = [];

    for (const day of plan.weeklyPlan) {
        for (const ex of day.exercises) {
            const exName = (ex.name || "").toLowerCase();
            if (!exName) continue;
            for (const tag of injuryTags) {
                for (const forbidden of tag.forbiddenExercises) {
                    if (exName.includes(forbidden.toLowerCase())) {
                        violations.push({
                            day: day.day,
                            exercise: ex.name,
                            reason: `Matches forbidden pattern "${forbidden}" for ${tag.label}`,
                            injuryId: tag.id,
                        });
                        break;
                    }
                }
            }
        }
    }

    return { ok: violations.length === 0, violations };
}

// ---------------------------------------------------------------------------
// Weight format validation — soft check, log warnings only
// ---------------------------------------------------------------------------

export function validateWeightFormat(plan: WorkoutPlan): string[] {
    const warnings: string[] = [];
    for (const day of plan.weeklyPlan) {
        for (const ex of day.exercises) {
            const w = (ex.weight || "").trim().toLowerCase();
            if (!w) continue;
            const ok =
                w === "bodyweight" ||
                w.includes("kg") ||
                /^\d+(\.\d+)?$/.test(w);
            if (!ok) {
                warnings.push(`${day.day} / ${ex.name}: weight "${ex.weight}" is not in kg format`);
            }
        }
    }
    return warnings;
}

// ---------------------------------------------------------------------------
// Cache key contributors — what should bust the cache when changed
// ---------------------------------------------------------------------------

export function cacheKeyContributors(
    questionnaire: QuestionnaireData,
    metrics: BodyMetrics | undefined,
    difficulty: Difficulty,
    injuryTags: InjuryTag[]
): Record<string, unknown> {
    return {
        goal: questionnaire.fitnessGoal,
        difficulty,
        frequency: questionnaire.weeklyFrequency,
        equipment: [...questionnaire.availableEquipment].sort(),
        duration: questionnaire.sessionDuration,
        injuries: injuryTags.map((t) => t.id).sort(),
        weightBucketKg: metrics?.weightKg
            ? Math.round(metrics.weightKg / 5) * 5
            : null,
        sex: metrics?.sex ?? null,
    };
}
