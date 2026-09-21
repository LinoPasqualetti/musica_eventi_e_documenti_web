// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const TOKEN_KEY = 'mpt_token';
const USER_KEY = 'mpt_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      const savedUser = localStorage.getItem(USER_KEY);
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
    } catch (e) {
      console.warn('Errore lettura localStorage:', e);
    }
    setLoading(false);
  }, []);

  const persist = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    if (newToken) localStorage.setItem(TOKEN_KEY, newToken);
    if (newUser) localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  };

  const clear = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const register = async ({ email, password, full_name }) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Errore registrazione' };
      persist(data.token, data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: 'Errore di connessione al server' };
    }
  };

  const login = async ({ email, password }) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Credenziali non valide' };
      persist(data.token, data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: 'Errore di connessione al server' };
    }
  };

  const logout = () => {
    clear();
  };

  const updateProfile = async ({ full_name, bio }) => {
    if (!token) return { ok: false, error: 'Non autenticato' };
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ full_name, bio }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Errore aggiornamento' };
      persist(token, data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: 'Errore di connessione al server' };
    }
  };

  const changePassword = async ({ old_password, new_password }) => {
    if (!token) return { ok: false, error: 'Non autenticato' };
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ old_password, new_password }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Errore cambio password' };
      return { ok: true, message: data.message };
    } catch (e) {
      return { ok: false, error: 'Errore di connessione al server' };
    }
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    register,
    login,
    logout,
    updateProfile,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro AuthProvider');
  return ctx;
}
