export const TABS = [
    {
        name: 'index',
        label: 'Home',
        icon: {
            sf: 'house.fill',
            drawable: 'ic_home',
        },
    },
    {
        name: 'workouts',
        label: 'Workouts',
        icon: {
            sf: 'figure.strengthtraining.traditional',
            drawable: 'ic_fitness',
        },
    },
    {
        name: 'challenges',
        label: 'Challenges',
        icon: {
            sf: 'trophy.fill',
            drawable: 'ic_trophy',
        },
    },
    {
        name: 'progress',
        label: 'Progress',
        icon: {
            sf: 'chart.line.uptrend.xyaxis',
            drawable: 'ic_chart',
        },
    },
    {
        name: 'profile',
        label: 'Profile',
        icon: {
            sf: 'person.fill',
            drawable: 'ic_person',
        },
    },
] as const;
