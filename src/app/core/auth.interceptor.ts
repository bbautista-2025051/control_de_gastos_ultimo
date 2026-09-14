import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, throwError } from "rxjs";
import { TOKEN_KEY } from "./auth.service";
import { ToastService } from "./toast.service";

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem(TOKEN_KEY);
  const router = inject(Router);
  const toast = inject(ToastService);

  if (!token) {
    return next(req);
  }

  const authorized = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });

  return next(authorized).pipe(
    catchError((error) => {
      if (error.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        toast.error("Su sesión ha expirado. Por favor, inicie sesión nuevamente.", "Sesión expirada");
        void router.navigate(["/login"]);
      }
      return throwError(() => error);
    })
  );
};
