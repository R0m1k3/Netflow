import api from './api';
import { create } from 'zustand';

interface User {
    id: string;
    username: string;
    email: string;
    thumb?: string;
    subscription?: any;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (identifier: string, password: string) => Promise<void>;
    register: (email: string, password: string, username: string) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,

    login: async (identifier: string, password: string) => {
        const res = await api.post('/auth/login', { identifier, password });
        if (res.authenticated) {
            set({ user: res.user, isAuthenticated: true });
        }
    },

    register: async (email: string, password: string, username: string) => {
        const res = await api.post('/auth/register', { email, password, username });
        if (res.success) {
            set({ user: res.user, isAuthenticated: true });
        }
    },

    logout: async () => {
        try {
            await api.post('/auth/logout');
        } catch (e) {
            console.error('Logout failed', e);
        } finally {
            set({ user: null, isAuthenticated: false });
        }
    },

    checkAuth: async () => {
        try {
            const res = await api.get('/auth/session');
            if (res.authenticated) {
                set({ user: res.user, isAuthenticated: true });
            } else {
                set({ user: null, isAuthenticated: false });
            }
        } catch (error) {
            set({ user: null, isAuthenticated: false });
        } finally {
            set({ isLoading: false });
        }
    }
}));
