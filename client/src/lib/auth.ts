import { apiRequest } from "./queryClient";

export interface User {
  id: number;
  email: string;
  name: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status}: ${text}`);
  }

  const data = await response.json();
  
  if (data.token) {
    // Store the token and user data in localStorage
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
  }
  
  return data;
}

export function logout(): void {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/";
}

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function getUser(): User | null {
  const user = localStorage.getItem("user");
  if (user) {
    return JSON.parse(user);
  }
  return null;
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
