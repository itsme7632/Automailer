import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, LoginInput, RegisterInput, setAuthTokenGetter, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { login as apiLogin, register as apiRegister, logout as apiLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (data: LoginInput) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(localStorage.getItem("auth_token"));
  const queryClient = useQueryClient();

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("auth_token"));
  }, []);

  const setToken = (newToken: string | null) => {
    if (newToken) {
      localStorage.setItem("auth_token", newToken);
    } else {
      localStorage.removeItem("auth_token");
    }
    setTokenState(newToken);
  };

  const { data: user = null, isLoading } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
      queryKey: getGetMeQueryKey(),
    }
  });

  const login = async (data: LoginInput) => {
    const res = await apiLogin(data);
    setToken(res.token);
    queryClient.setQueryData(getGetMeQueryKey(), res.user);
  };

  const register = async (data: RegisterInput) => {
    const res = await apiRegister(data);
    setToken(res.token);
    queryClient.setQueryData(getGetMeQueryKey(), res.user);
  };

  const logout = async () => {
    try {
      await apiLogout();
    } finally {
      setToken(null);
      queryClient.setQueryData(getGetMeQueryKey(), null);
      queryClient.clear();
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading: isLoading && !!token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}