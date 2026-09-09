export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  hasPassword: boolean;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface MeResponse {
  user: AuthUser;
}
