import { HttpClient } from "@angular/common/http";
import { Injectable, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { Observable, tap } from "rxjs";
import type { AuthUser, LoginResponse, MeResponse } from "./auth.models";
import { InactivityService } from "./inactivity.service";

export const TOKEN_KEY = "auth_token";

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly inactivity = inject(InactivityService);

  private readonly userSignal = signal<AuthUser | null>(null);
  readonly user = this.userSignal.asReadonly();

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>("/api/auth/login", { email, password })
      .pipe(
        tap(({ token, user }) => {
          localStorage.setItem(TOKEN_KEY, token);
          this.userSignal.set(user);
          this.startInactivityTracking();
        })
      );
  }

  googleLogin(credential: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>("/api/auth/google", { credential })
      .pipe(
        tap(({ token, user }) => {
          localStorage.setItem(TOKEN_KEY, token);
          this.userSignal.set(user);
          this.startInactivityTracking();
        })
      );
  }

  me(): Observable<MeResponse> {
    return this.http.get<MeResponse>("/api/auth/me").pipe(
      tap(({ user }) => {
        this.userSignal.set(user);
        if (this.token) {
          this.startInactivityTracking();
        }
      })
    );
  }

  updateProfile(name: string, email: string): Observable<MeResponse> {
    return this.http.patch<MeResponse>("/api/auth/me", { name, email }).pipe(
      tap(({ user }) => {
        this.userSignal.set(user);
      })
    );
  }

  changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>("/api/auth/change-password", {
      currentPassword,
      newPassword,
      confirmPassword,
    });
  }

  logout(): void {
    this.inactivity.stop();
    localStorage.removeItem(TOKEN_KEY);
    this.userSignal.set(null);
    void this.router.navigate(["/login"]);
  }

  private startInactivityTracking(): void {
    this.inactivity.start(() => this.logout());
  }
}
