import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getStoredSession, patrolLogin as loginService, patrolLogout as logoutService } from '../services/auth.service';
import { AuthState, LoginForm, Funcionario, SesionOperativa } from '../types';

interface AuthContextType extends AuthState {
  login: (form: LoginForm & { tripulacion?: string[] }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    patrol_id: null,
    funcionario: null,
    sesion: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Recuperar sesión al iniciar (Tarea #44 — redirección automática)
  useEffect(() => {
    async function restoreSession() {
      try {
        const stored = await getStoredSession();
        if (stored) {
          setState({
            token: stored.token,
            patrol_id: stored.patrol_id,
            funcionario: stored.funcionario,
            sesion: stored.sesion,
            isLoading: false,
            isAuthenticated: true,
          });
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    }
    restoreSession();
  }, []);

  const login = async (form: LoginForm) => {
    const data = await loginService(form);
    setState({
      token: data.token,
      patrol_id: data.patrol_id,
      funcionario: data.funcionario,
      sesion: data.sesion,
      isLoading: false,
      isAuthenticated: true,
    });
  };

  const logout = async () => {
    await logoutService();
    setState({
      token: null,
      patrol_id: null,
      funcionario: null,
      sesion: null,
      isLoading: false,
      isAuthenticated: false,
    });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
