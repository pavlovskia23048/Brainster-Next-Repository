# Fitness Hub

A React Native fitness app built with Expo. Tracks workouts, body measurements, and progress photos. Has a social layer (friends, invitations, challenges), a gamified level system, and AI-generated workout plans backed by Firebase Cloud Functions.

## What's in it

**Workouts**
- Custom workouts with sets, reps, weight, photos, notes
- Backdate logs with a date picker
- Edit and delete past entries

**Social**
- Friend system, workout invitations with messages, activity feed
- Challenges between friends, leaderboards by streak

**Progress**
- Body measurements (weight, chest, waist, etc.)
- Progress photos with before/after view
- Streak tracking, workout calendar, stats dashboard

**Gamification**
- 30 levels across 6 tiers (Bronze through Legendary)
- Points per workout, achievement badges
- Streak milestone notifications (3, 7, 14, 30, 50, 100 days)

**AI plans**
- Questionnaire flow that generates a personalized weekly plan via Gemini
- Backed by a v2 Cloud Function with a free monthly quota and a premium tier
- Plans are saved to Firestore and can be archived or deleted

**Notifications**
- Database-backed so they work in Expo Go
- Push notifications in production builds

## Stack

| Layer | Tech |
|---|---|
| Framework | React Native 0.81, Expo 54 |
| Routing | Expo Router (file-based) |
| Language | TypeScript |
| Styling | NativeWind (Tailwind for RN) + custom theming with light/dark |
| State | React hooks + context (no Redux) |
| Auth + DB | Firebase Auth, Firestore, Storage |
| Cloud functions | Firebase Functions v2 (gen2), Node.js 20 |
| AI | Google Gemini via `@google/generative-ai` |
| Charts | react-native-gifted-charts, react-native-calendars |
| Tests | Jest |

## Getting started

### Prerequisites

- Node 18+ and npm (Bun lockfile is also committed if you prefer Bun)
- Xcode for iOS, Android Studio for Android
- Firebase CLI: `npm install -g firebase-tools`

### First-time setup

```bash
git clone git@github.com:weboook/fitness-hub-app.git
cd fitness-hub-app
npm install
```

Then configure Firebase:

1. Create a project at https://console.firebase.google.com
2. Enable Email/Password auth, Firestore, and Storage
3. Drop `google-services.json` in the project root
4. Update `config/firebase.ts` with your web config
5. Push the rules and indexes:
   ```bash
   firebase deploy --only firestore
   ```

For AI plan generation you also need a Gemini key stored as a Firebase secret:

```bash
firebase functions:secrets:set GEMINI_API_KEY
firebase deploy --only functions
```

Get a Gemini key at https://aistudio.google.com/apikey.

### Running the app

```bash
# Start Metro and pick a target interactively
npm start

# Web (opens at http://localhost:8081)
npm run web

# iOS simulator (requires Xcode)
npm run ios

# Android emulator (requires Android Studio)
npm run android
```

The `ios` and `android` scripts call `expo start --ios` / `--android`, which loads the JS in Expo Go. For a native dev client build (needed if you add custom native modules):

```bash
npx expo run:ios
npx expo run:android
```

Native builds take 5 to 15 minutes the first time, then incremental rebuilds are fast.

### Running with the Firebase emulator

For offline dev or to avoid touching prod data:

```bash
firebase emulators:start
```

Then in `config/firebase.ts`, connect the SDK to localhost. There's no automatic toggle, you have to add it manually for now.

## Project structure

```
fitness-hub-app/
├── app/                          Expo Router screens (file-based routing)
│   ├── (auth)/                   Login, signup, get-started
│   ├── (dash)/
│   │   ├── (tabs)/               Bottom tab screens
│   │   │   ├── index.tsx         Home
│   │   │   ├── workouts.tsx
│   │   │   ├── challenges.tsx
│   │   │   ├── progress.tsx
│   │   │   └── profile.tsx
│   │   ├── ai-plans.tsx          AI plan list
│   │   ├── ai-questionnaire.tsx  Plan generation flow
│   │   ├── plan-detail.tsx
│   │   ├── create-workout.tsx
│   │   ├── workout-detail.tsx
│   │   ├── workout-invitation.tsx
│   │   ├── edit-profile.tsx
│   │   ├── friends.tsx
│   │   ├── notifications.tsx
│   │   ├── subscription.tsx
│   │   └── ...                   Settings, legal, etc.
│   ├── _layout.tsx               Root navigator
│   └── index.tsx                 Entry redirect
├── components/
│   ├── common/                   Shared building blocks (Text, etc.)
│   ├── shared/
│   └── ui/
├── config/
│   ├── firebase.ts               Firebase client init
│   ├── supabase.ts               (legacy, can be removed if unused)
│   └── toastConfig.tsx
├── constants/                    Theme, colors, fonts, tab metadata
├── contexts/
│   └── ThemeContext.tsx          Light/dark/system theme
├── hooks/
├── interfaces/                   TypeScript types
├── services/
│   ├── accountService.ts         Account deletion, reauth
│   ├── aiPlanService.ts          AI plan CRUD against Firestore
│   └── subscriptionService.ts    Premium tier helpers
├── utils/
│   ├── dialogs.ts                Cross-platform Alert wrapper (web safe)
│   ├── levelSystem.ts
│   ├── notifications.ts
│   └── strings.ts
├── functions/
│   └── src/
│       ├── generatePlan.ts       v2 onCall, calls Gemini
│       ├── aiTools.ts            Prompt construction, validators
│       └── index.ts
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
└── app.json                      Expo config
```

## Firestore collections

| Collection | What it holds |
|---|---|
| `users` | Profile, stats, subscription tier, body metrics |
| `workoutLogs` | Completed workouts |
| `measurements` | Body measurements over time |
| `progressPhotos` | Before/after photos |
| `friendships` | Friend relationships |
| `challenges` | Friend-to-friend challenges |
| `workoutInvitations` | Invites sent between friends |
| `notifications` | In-app notification feed |
| `workoutPlans` | AI-generated plans |

## Storage layout

```
workouts/{userId}/{workoutId}/{timestamp}.jpg
progress/{userId}/{photoId}.jpg
avatars/{userId}.jpg
```

## Testing

```bash
npm test              # Run Jest suite once
npm run lint          # ESLint + Prettier check
npm run format        # Auto-fix lint and format
```

## Production builds

EAS is configured in `eas.json`. From a clean working tree:

```bash
eas build --platform ios
eas build --platform android
```

For OTA JS updates without rebuilding:

```bash
eas update
```

## Notes

- The web target is supported but it's a secondary surface. Some native APIs (camera, native picker confirmations) fall back to web equivalents through `utils/dialogs.ts` and similar helpers, but expect rougher edges than mobile.
- The Cloud Function `generateWorkoutPlan` whitelists CORS for `localhost:*` and the Firebase Hosting domains. If you add a custom domain, update the `cors` array in `functions/src/generatePlan.ts`.
- Node.js 20 is being deprecated by Google Cloud Functions on 2026-10-30. Bump `runtime` in `firebase.json` to `nodejs22` before then.

## License

Private and proprietary.
