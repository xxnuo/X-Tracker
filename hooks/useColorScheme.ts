import { useThemeContext } from './useThemeContext';

export function useColorScheme() {
  const { colorScheme } = useThemeContext();
  return colorScheme;
}
