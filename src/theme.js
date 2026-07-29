import { createTheme } from '@mantine/core';

export const theme = createTheme({
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontFamilyHeadings: "'Plus Jakarta Sans', 'Inter', sans-serif",
  headings: { fontWeight: '800' },
  primaryColor: 'brand',
  primaryShade: 6,
  defaultRadius: 'lg',
  colors: {
    brand: [
      '#eef2ff',
      '#dee5ff',
      '#b9c6ff',
      '#8fa2fe',
      '#6a83fb',
      '#4a68f2',
      '#3355e8',
      '#2743c4',
      '#1d3399',
      '#141b4d',
    ],
  },
  shadows: {
    xs: '0 1px 2px rgba(16, 20, 44, 0.05)',
    sm: '0 6px 16px rgba(16, 20, 44, 0.06)',
    md: '0 16px 36px rgba(16, 20, 44, 0.09)',
    lg: '0 30px 70px rgba(14, 20, 60, 0.18)',
  },
  radius: { xs: '8px', sm: '12px', md: '16px', lg: '22px', xl: '28px' },
  components: {
    Button: {
      defaultProps: { radius: 'xl' },
      styles: { root: { fontWeight: 700 } },
    },
    Card: {
      defaultProps: { radius: 'lg' },
    },
    Paper: {
      defaultProps: { radius: 'lg' },
    },
    Modal: {
      defaultProps: { radius: 'lg', overlayProps: { backgroundOpacity: 0.45, blur: 3 } },
      styles: { title: { fontWeight: 800 } },
    },
    Badge: {
      defaultProps: { radius: 'sm' },
    },
    TextInput: {
      defaultProps: { radius: 'md' },
    },
    Textarea: {
      defaultProps: { radius: 'md' },
    },
    PasswordInput: {
      defaultProps: { radius: 'md' },
    },
  },
});

export const COLORS = {
  bg: '#f5f6fc',
  card: '#ffffff',
  border: 'rgba(23, 35, 94, 0.09)',
  blue: '#3355e8',
  blueDark: '#141b4d',
  violet: '#7c6cf6',
  green: '#12b76a',
  text: '#10142c',
  textMuted: '#5b6178',
};
