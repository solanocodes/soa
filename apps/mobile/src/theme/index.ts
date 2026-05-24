export { colors, tierColors } from './colors';
export { spacing } from './spacing';

export const typography = {
  fontFamily: {
    light: 'Inter_300Light',
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 20,
} as const;
