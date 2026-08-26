// web-frontend/src/contexts/ThemeContext.js
import React, { createContext, useState, useMemo, useContext, useEffect } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline'; // Resets CSS for Material-UI

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
    const [mode, setMode] = useState(() => {
        // Load theme preference from local storage, default to 'light'
        return localStorage.getItem('themeMode') || 'light';
    });

    // Save theme preference to local storage whenever it changes
    useEffect(() => {
        localStorage.setItem('themeMode', mode);
    }, [mode]);

    const toggleColorMode = () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
    };

    // Memoize the theme creation to prevent unnecessary re-renders
    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode, // 'light' or 'dark'
                    primary: {
                        main: '#1976d2', // Example primary color
                    },
                    secondary: {
                        main: '#dc004e', // Example secondary color
                    },
                    // You can define other colors like background, text, etc.
                },
                // You can add more theme customizations here (typography, components, etc.)
            }),
        [mode], // Recreate theme only when mode changes
    );

    const value = {
        mode,
        toggleColorMode,
    };

    return (
        <ThemeContext.Provider value={value}>
            {/* MuiThemeProvider applies the Material-UI theme */}
            <MuiThemeProvider theme={theme}>
                <CssBaseline /> {/* CssBaseline provides a consistent baseline for styling */}
                {children}
            </MuiThemeProvider>
        </ThemeContext.Provider>
    );
};

// Custom hook to use the ThemeContext
export const useThemeToggle = () => {
    return useContext(ThemeContext);
};