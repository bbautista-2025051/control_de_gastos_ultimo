export interface AuthUser {
  id: string;
  name: string;
  email: string;
  picture: string | null;
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
