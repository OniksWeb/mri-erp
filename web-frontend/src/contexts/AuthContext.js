// web-frontend/src/contexts/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null); // Create the context

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null); // Stores user info { id, username, role, etc. }
    const [token, setToken] = useState(localStorage.getItem('token')); // Load token from local storage
    const navigate = useNavigate(); // For redirecting after login/logout

    // Effect to set user and handle token changes
    useEffect(() => {
        if (token) {
            // In a real app, you'd verify the token with the backend
            // or decode it here to get user info if it's securely structured.
            // For now, we'll assume we get user info during login response.
            // Or you could re-fetch user details based on token.
            // For simplicity now, we will set user directly from login response.
            // For now, if token exists, we just consider user "logged in" until we get actual user data.
            // You might add a 'loadUser' function that calls backend '/api/me'
        } else {
            setUser(null);
        }
    }, [token]); // Rerun when token changes

    const login = async (userData, jwtToken) => {
        setToken(jwtToken);
        setUser(userData);
        localStorage.setItem('token', jwtToken); // Store token
        localStorage.setItem('user', JSON.stringify(userData)); // Store user data
        navigate('/dashboard'); // Redirect to dashboard after successful login
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token'); // Clear token
        localStorage.removeItem('user'); // Clear user data
        navigate('/login'); // Redirect to login after logout
    };

    // Attempt to load user from localStorage on initial load
    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        if (storedToken && storedUser) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
        }
    }, []);


    const value = {
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token // A boolean indicating if user is logged in
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the AuthContext
export const useAuth = () => {
    return useContext(AuthContext);
};