import { StyleSheet, View, TouchableOpacity, ImageBackground, Dimensions, Animated, StatusBar } from 'react-native';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Text } from '@/components/common/Text';
import { useRouter } from 'expo-router';
import { FITNESS_IMAGES } from '@/constants/fitnessImages';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const { width, height } = Dimensions.get('window');

export default function GetStarted() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

    useEffect(() => {
        const interval = setInterval(() => {
            // Fade out
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }).start(() => {
                // Change image
                setCurrentImageIndex((prevIndex) =>
                    (prevIndex + 1) % FITNESS_IMAGES.length
                );
                // Fade in
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }).start();
            });
        }, 4000); // Change image every 4 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarBackground} />
            <Animated.View style={[styles.imageContainer, { opacity: fadeAnim }]}>
                <ImageBackground
                    source={{ uri: FITNESS_IMAGES[currentImageIndex].uri }}
                    style={styles.backgroundImage}
                    resizeMode="cover"
                >
                    <LinearGradient
                        colors={isDark
                            ? ['rgba(15,23,42,0.7)', 'rgba(30,41,59,0.85)', 'rgba(30,41,59,0.95)']
                            : ['rgba(13,27,62,0.7)', 'rgba(27,49,108,0.85)', 'rgba(27,49,108,0.95)']}
                        style={styles.gradient}
                    />
                </ImageBackground>
            </Animated.View>

            <View style={styles.content}>
                <View style={styles.logoContainer}>
                    <MaterialCommunityIcons name="dumbbell" size={50} color={theme.text} />
                </View>

                <Text style={styles.title}>Fitness Challenge Hub</Text>
                <Text style={styles.subtitle}>
                    Transform your body, challenge your limits, achieve greatness
                </Text>

                <View style={styles.featuresContainer}>
                    <View style={styles.feature}>
                        <Text style={styles.featureText}>Track{'\n'}Workouts</Text>
                    </View>
                    <View style={styles.featureDivider} />
                    <View style={styles.feature}>
                        <Text style={styles.featureText}>Join{'\n'}Challenges</Text>
                    </View>
                    <View style={styles.featureDivider} />
                    <View style={styles.feature}>
                        <Text style={styles.featureText}>See{'\n'}Progress</Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.button}
                    onPress={() => router.push('/(auth)/login')}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={isDark ? [theme.surface, theme.surfaceElevated] : ['#ffffff', '#f0f0f0']}
                        style={styles.buttonGradient}
                    >
                        <Text style={styles.buttonText}>Get Started</Text>
                        <Text style={styles.buttonIcon}>→</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <View style={styles.indicators}>
                    {FITNESS_IMAGES.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.indicator,
                                currentImageIndex === index && styles.activeIndicator,
                            ]}
                        />
                    ))}
                </View>
            </View>
        </View>
    );
}

const createStyles = (theme: ThemeColors, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    imageContainer: {
        position: 'absolute',
        width: width,
        height: height,
    },
    backgroundImage: {
        width: '100%',
        height: '100%',
    },
    gradient: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    content: {
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: 30,
        paddingBottom: 50,
    },
    logoContainer: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: isDark ? 'rgba(241,245,249,0.15)' : 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 2,
        borderColor: isDark ? 'rgba(241,245,249,0.3)' : 'rgba(255,255,255,0.3)',
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#ffffff',
        marginBottom: 12,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: isDark ? 'rgba(241,245,249,0.9)' : 'rgba(255,255,255,0.9)',
        marginBottom: 40,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 20,
    },
    featuresContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        width: '100%',
        marginBottom: 40,
        paddingHorizontal: 20,
        paddingVertical: 20,
        backgroundColor: isDark ? 'rgba(241,245,249,0.1)' : 'rgba(255,255,255,0.1)',
        borderRadius: 12,
    },
    feature: {
        alignItems: 'center',
        flex: 1,
    },
    featureDivider: {
        width: 1,
        height: 30,
        backgroundColor: isDark ? 'rgba(241,245,249,0.3)' : 'rgba(255,255,255,0.3)',
    },
    featureText: {
        fontSize: 13,
        color: isDark ? 'rgba(241,245,249,0.95)' : 'rgba(255,255,255,0.95)',
        textAlign: 'center',
        fontWeight: '600',
        lineHeight: 18,
    },
    button: {
        width: '100%',
        marginBottom: 30,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    buttonGradient: {
        paddingVertical: 18,
        paddingHorizontal: 32,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: theme.primary,
        fontSize: 18,
        fontWeight: '700',
        marginRight: 8,
    },
    buttonIcon: {
        color: theme.primary,
        fontSize: 20,
        fontWeight: 'bold',
    },
    indicators: {
        flexDirection: 'row',
        gap: 8,
    },
    indicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: isDark ? 'rgba(241,245,249,0.3)' : 'rgba(255,255,255,0.3)',
    },
    activeIndicator: {
        backgroundColor: theme.text,
        width: 24,
    },
});