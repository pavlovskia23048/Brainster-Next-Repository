export interface ThemeColors {
  // Backgrounds
  background: string;
  surface: string;
  surfaceElevated: string;
  card: string;

  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;

  // Brand
  primary: string;
  primaryLight: string;
  primaryDark: string;

  // Accents
  accent: string;
  success: string;
  error: string;
  warning: string;

  // UI
  border: string;
  divider: string;
  shadow: string;
  overlay: string;

  // StatusBar
  statusBar: 'light-content' | 'dark-content';
  statusBarBackground: string;

  // Tab bar
  tabBarBackground: string;
  tabBarActive: string;
  tabBarInactive: string;

  // Charts
  chartPrimary: string;
  chartSecondary: string;
  chartGrid: string;
}

export const lightTheme: ThemeColors = {
  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  card: '#FFFFFF',
  text: '#1B1B1B',
  textSecondary: '#666666',
  textTertiary: '#999999',
  primary: '#1B316C',
  primaryLight: '#F0F4FF',
  primaryDark: '#142547',
  accent: '#FF6B35',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  border: '#F0F0F0',
  divider: '#E5E5E5',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
  statusBar: 'dark-content',
  statusBarBackground: '#FFFFFF',
  tabBarBackground: '#FFFFFF',
  tabBarActive: '#1B316C',
  tabBarInactive: '#999999',
  chartPrimary: '#1B316C',
  chartSecondary: '#10B981',
  chartGrid: 'rgba(229, 229, 229, 0.5)',
};

export const darkTheme: ThemeColors = {
  background: '#0F172A',      // Slate 900
  surface: '#1E293B',         // Slate 800
  surfaceElevated: '#334155', // Slate 700
  card: '#1E293B',            // Same as surface — card variant for layered UI
  text: '#F1F5F9',           // Slate 100
  textSecondary: '#94A3B8',  // Slate 400
  textTertiary: '#64748B',   // Slate 500
  primary: '#3B82F6',        // Brighter blue for dark mode
  primaryLight: '#1E3A5F',
  primaryDark: '#60A5FA',
  accent: '#FB923C',         // Brighter orange
  success: '#34D399',
  error: '#F87171',
  warning: '#FBBF24',
  border: '#334155',
  divider: '#334155',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.8)',
  statusBar: 'light-content',
  statusBarBackground: '#0F172A',
  tabBarBackground: '#1E293B',
  tabBarActive: '#60A5FA',
  tabBarInactive: '#64748B',
  chartPrimary: '#60A5FA',
  chartSecondary: '#34D399',
  chartGrid: 'rgba(71, 85, 105, 0.3)',
};
