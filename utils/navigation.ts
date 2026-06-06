import { Router } from 'expo-router';

export const safeBack = (router: Router, fallback: string = '/') => {
    if (router.canGoBack()) {
        router.back();
    } else {
        router.replace(fallback as never);
    }
};
