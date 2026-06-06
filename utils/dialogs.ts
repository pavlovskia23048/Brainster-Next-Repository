import { Alert, AlertButton, Platform } from 'react-native';

export const showAlert = (
    title: string,
    message?: string,
    buttons?: AlertButton[],
): void => {
    if (Platform.OS !== 'web') {
        Alert.alert(title, message, buttons);
        return;
    }

    const body = message ? `${title}\n\n${message}` : title;

    if (!buttons || buttons.length === 0) {
        window.alert(body);
        return;
    }

    if (buttons.length === 1) {
        window.alert(body);
        buttons[0].onPress?.();
        return;
    }

    const cancelIdx = buttons.findIndex(b => b.style === 'cancel');

    if (buttons.length === 2 && cancelIdx >= 0) {
        const confirmBtn = buttons[1 - cancelIdx];
        const cancelBtn = buttons[cancelIdx];
        if (window.confirm(body)) {
            confirmBtn.onPress?.();
        } else {
            cancelBtn.onPress?.();
        }
        return;
    }

    const numbered = buttons.map((b, i) => `${i + 1}. ${b.text}`).join('\n');
    const input = window.prompt(`${body}\n\n${numbered}\n\nEnter number:`);
    if (input === null) {
        buttons[cancelIdx >= 0 ? cancelIdx : 0].onPress?.();
        return;
    }
    const idx = parseInt(input, 10) - 1;
    if (idx >= 0 && idx < buttons.length) {
        buttons[idx].onPress?.();
    }
};
