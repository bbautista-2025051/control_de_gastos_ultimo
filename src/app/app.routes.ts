import { Routes } from "@angular/router";
import { authGuard } from "./core/auth.guard";

export const routes: Routes = [
  { path: "", pathMatch: "full", redirectTo: "dashboard" },
  {
    path: "login",
    loadComponent: () =>
      import("./features/login/login").then((m) => m.Login),
  },
  {
    path: "dashboard",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./features/dashboard/dashboard").then((m) => m.Dashboard),
  },
  {
    path: "transacciones",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./features/transacciones/transacciones").then(
        (m) => m.Transacciones
      ),
  },
  {
    path: "categorias",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./features/categorias/categorias").then(
        (m) => m.Categorias
      ),
  },
  {
    path: "reportes",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./features/reportes/reportes").then(
        (m) => m.Reportes
      ),
  },
  {
    path: "ajustes",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./features/ajustes/ajustes").then(
        (m) => m.Ajustes
      ),
  },
  { path: "**", redirectTo: "dashboard" },
];
