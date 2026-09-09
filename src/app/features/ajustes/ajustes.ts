import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { RouterLink, RouterLinkActive } from "@angular/router";
import type { AuthUser } from "../../core/auth.models";
import { AuthService } from "../../core/auth.service";
import { ToastService } from "../../core/toast.service";

const STRENGTH_META = [
  { label: "Muy débil", bar: "#f87171", text: "#e04545" },
  { label: "Débil", bar: "#fb923c", text: "#d97706" },
  { label: "Media", bar: "#eab308", text: "#a16207" },
  { label: "Fuerte", bar: "#84cc16", text: "#4d7c0f" },
  { label: "Muy fuerte", bar: "#34d399", text: "#047857" },
] as const;

type SectionKey = "perfil" | "password" | "cuenta";

@Component({
  selector: "app-ajustes",
  imports: [ReactiveFormsModule, RouterLink, RouterLinkActive],
  templateUrl: "./ajustes.html",
  styleUrl: "./ajustes.css",
})
export class Ajustes implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly user = this.auth.user;
  readonly canChangePassword = computed(() => this.user()?.hasPassword ?? true);
  readonly menuOpen = signal(false);
  readonly section = signal<SectionKey>("perfil");
  loadError = false;
  pending = false;

  readonly form = this.fb.group({
    name: this.fb.nonNullable.control("", [
      Validators.required,
      Validators.minLength(2),
      Validators.maxLength(100),
    ]),
    email: this.fb.nonNullable.control("", [
      Validators.required,
      Validators.email,
    ]),
  });

  readonly passwordForm = this.fb.group({
    currentPassword: this.fb.nonNullable.control("", [
      Validators.required,
    ]),
    newPassword: this.fb.nonNullable.control("", [
      Validators.required,
      Validators.minLength(8),
      passwordRules,
    ]),
    confirmPassword: this.fb.nonNullable.control("", [
      Validators.required,
    ]),
  });

  passwordError = "";
  pendingPassword = false;
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  readonly strengthSegments = [1, 2, 3, 4];

  readonly hasChanges = computed(() => {
    const current = this.user();
    if (!current) {
      return false;
    }
    return (
      this.name.value.trim() !== current.name ||
      this.email.value.trim().toLowerCase() !== current.email.toLowerCase()
    );
  });

  readonly passwordHasMismatch = computed(
    () =>
      this.confirmPassword.dirty &&
      this.confirmPassword.value.length > 0 &&
      this.confirmPassword.value !== this.newPassword.value
  );

  readonly passwordScore = computed(() => {
    const value = this.newPassword.value ?? "";
    if (!value) {
      return 0;
    }
    let score = 0;
    if (value.length >= 8) score++;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[^a-zA-Z0-9]/.test(value)) score++;
    return score;
  });

  readonly strengthMeta = computed(() =>
    this.passwordScore() > 0
      ? STRENGTH_META[this.passwordScore() - 1]
      : null
  );

  get name() {
    return this.form.controls.name;
  }

  get email() {
    return this.form.controls.email;
  }

  get currentPassword() {
    return this.passwordForm.controls.currentPassword;
  }

  get newPassword() {
    return this.passwordForm.controls.newPassword;
  }

  get confirmPassword() {
    return this.passwordForm.controls.confirmPassword;
  }

  ngOnInit(): void {
    this.auth.me().subscribe({
      next: ({ user }) => this.patchForm(user),
      error: () => {
        this.loadError = true;
      },
    });
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    if (!this.hasChanges()) {
      this.toast.info("No hay cambios para guardar.", "Sin cambios");
      return;
    }

    this.pending = true;
    this.auth
      .updateProfile(this.name.value.trim(), this.email.value.trim())
      .subscribe({
        next: ({ user }) => {
          this.pending = false;
          this.patchForm(user);
          this.toast.success(
            "Tu perfil se ha actualizado correctamente.",
            "Perfil actualizado"
          );
        },
        error: (err: HttpErrorResponse) => {
          this.pending = false;
          const message =
            err.status === 0
              ? "No se pudo conectar con el servidor. Intente de nuevo."
              : (err.error?.error as string | undefined) ??
                "No se pudo actualizar el perfil.";
          this.toast.error(message, "Error");
        },
      });
  }

  submitPassword(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid || this.passwordHasMismatch()) {
      return;
    }

    this.passwordError = "";
    this.pendingPassword = true;

    this.auth
      .changePassword(
        this.currentPassword.value,
        this.newPassword.value,
        this.confirmPassword.value
      )
      .subscribe({
        next: () => {
          this.pendingPassword = false;
          this.toast.success(
            "La contraseña se actualizó. Vuelve a iniciar sesión con tu nueva contraseña.",
            "Contraseña actualizada"
          );
          this.passwordForm.reset();
          this.auth.logout();
        },
        error: (err: HttpErrorResponse) => {
          this.pendingPassword = false;
          this.passwordError =
            err.status === 0
              ? "No se pudo conectar con el servidor. Intente de nuevo."
              : (err.error?.error as string | undefined) ??
                "No se pudo actualizar la contraseña.";
        },
      });
  }

  selectSection(key: SectionKey): void {
    this.section.set(key);
  }

  private patchForm(user: AuthUser): void {
    this.form.patchValue({ name: user.name, email: user.email });
  }

  memberSince(value: string | undefined): string {
    if (!value) {
      return "—";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "—";
    }
    return new Intl.DateTimeFormat("es-GT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  initials(name: string | undefined): string {
    if (!name) {
      return "A";
    }
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase() || "A";
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  settings(): void {
    this.menuOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
  }
}

function passwordRules(control: { value: string }): { weak?: boolean } | null {
  const value = control.value ?? "";
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasNumber = /\d/.test(value);
  if (value.length >= 8 && hasUpper && hasLower && hasNumber) {
    return null;
  }
  return { weak: true };
}