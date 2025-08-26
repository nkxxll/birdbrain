import { createContext, useContext, useEffect, useState } from 'react';

const defaultThemeContext = {
  theme: 'light',
  toggleTheme: () => {},
};

const ThemeContext = createContext(defaultThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // Use a function to initialize state from localStorage for performance.
  // This prevents localStorage from being read on every re-render.
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    // Apply the correct class and update localStorage.
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]); // The effect re-runs only when the theme state changes.

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const contextValue = {
    theme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook for convenience and to ensure we're inside a provider.
export const useTheme = () => {
  const context = useContext(ThemeContext);
  // Optional: Add a check to ensure the hook is used within the provider.
  if (context === defaultThemeContext) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
