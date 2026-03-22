import { create } from 'zustand';

interface User {
  id: number;
  username: string;
  balance: number;
  email?: string;
  phone?: string;
  plan?: string;
  nextRefresh?: string;
}

interface UserState {
  user: User | null;
  token: string | null;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  updateBalance: (newBalance: number) => void;
  updatePlan: (newPlan: string, nextRefresh?: string) => void;
  updateProfile: (email: string, phone: string) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    set({ token });
  },
  setUser: (user) => set({ user }),
  updateBalance: (newBalance) =>
    set((state) => ({
      user: state.user ? { ...state.user, balance: newBalance } : null,
    })),
  updatePlan: (newPlan, nextRefresh) =>
    set((state) => ({
      user: state.user ? { ...state.user, plan: newPlan, nextRefresh: nextRefresh || state.user.nextRefresh } : null,
    })),
  updateProfile: (email, phone) =>
    set((state) => ({
      user: state.user ? { ...state.user, email, phone } : null,
    })),
  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null });
  },
}));
