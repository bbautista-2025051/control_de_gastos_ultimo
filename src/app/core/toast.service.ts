import { Injectable, signal } from "@angular/core";

export type ToastType = "success" | "error" | "info";

@Injectable({ providedIn: "root" })
export class ToastService {
  readonly visible = signal(false);
  readonly message = signal("");
  readonly title = signal("");
  readonly type = signal<ToastType>("info");

  private timeout: ReturnType<typeof setTimeout> | null = null;

  show(message: string, type: ToastType = "info", title?: string): void {
    this.clearTimer();
    this.message.set(message);
    this.type.set(type);
    this.title.set(title ?? this.defaultTitle(type));
    this.visible.set(true);
    this.timeout = setTimeout(() => this.hide(), 6000);
  }

  success(message: string, title?: string): void {
    this.show(message, "success", title);
  }

  error(message: string, title?: string): void {
    this.show(message, "error", title);
  }

  info(message: string, title?: string): void {
    this.show(message, "info", title);
  }

  hide(): void {
    this.clearTimer();
    this.visible.set(false);
  }

  private defaultTitle(type: ToastType): string {
    switch (type) {
      case "success":
        return "Operación exitosa";
      case "error":
        return "Error";
      case "info":
        return "Información";
    }
  }

  private clearTimer(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }
}