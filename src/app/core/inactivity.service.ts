import { Injectable, signal } from "@angular/core";

const INACTIVITY_TIMEOUT = 30 * 60 * 1000;
const WARNING_BEFORE = 3 * 60 * 1000;

const INTERACTION_EVENTS = [
  "click",
  "keydown",
  "mousedown",
  "mousemove",
  "scroll",
  "touchstart",
] as const;

@Injectable({ providedIn: "root" })
export class InactivityService {
  readonly isWarning = signal(false);
  readonly remainingSeconds = signal(0);

  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private onExpired: (() => void) | null = null;
  private boundHandler = this.handleInteraction.bind(this);
  private warningStart = 0;

  start(onExpired: () => void): void {
    this.stop();
    this.onExpired = onExpired;

    for (const event of INTERACTION_EVENTS) {
      document.addEventListener(event, this.boundHandler, { passive: true });
    }

    this.scheduleInactivity();
  }

  stop(): void {
    this.clearAll();
    this.onExpired = null;
    this.isWarning.set(false);
    this.remainingSeconds.set(0);

    for (const event of INTERACTION_EVENTS) {
      document.removeEventListener(event, this.boundHandler);
    }
  }

  extendSession(): void {
    this.isWarning.set(false);
    this.remainingSeconds.set(0);
    this.clearAll();
    this.scheduleInactivity();
  }

  private handleInteraction(): void {
    if (this.isWarning()) {
      this.extendSession();
    }
  }

  private scheduleInactivity(): void {
    this.clearAll();

    this.inactivityTimer = setTimeout(() => {
      this.startWarning();
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE);
  }

  private startWarning(): void {
    this.isWarning.set(true);
    this.warningStart = Date.now();
    this.remainingSeconds.set(Math.ceil(WARNING_BEFORE / 1000));

    this.countdownInterval = setInterval(() => {
      const elapsed = Date.now() - this.warningStart;
      const remaining = Math.max(0, Math.ceil((WARNING_BEFORE - elapsed) / 1000));
      this.remainingSeconds.set(remaining);

      if (remaining <= 0) {
        this.clearAll();
        this.isWarning.set(false);
        this.onExpired?.();
      }
    }, 250);
  }

  private clearAll(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }
}
