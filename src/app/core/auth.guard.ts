import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { TOKEN_KEY } from "./auth.service";
import { ToastService } from "./toast.service";

function isTokenValid(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const toast = inject(ToastService);
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token || !isTokenValid(token)) {
    localStorage.removeItem(TOKEN_KEY);
    toast.error("Su sesión ha expirado. Por favor, inicie sesión nuevamente.", "Sesión expirada");
    return router.createUrlTree(["/login"]);
  }

  return true;
};
