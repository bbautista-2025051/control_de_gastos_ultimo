import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { FormsModule } from "@angular/forms";
import { RouterLink, RouterLinkActive, Router } from "@angular/router";
import { AuthService } from "../../core/auth.service";
import { ToastService } from "../../core/toast.service";
import {
  ExpensesService,
  type DashboardSummary,
  type MonthSum,
} from "../../core/expenses.service";
import {
  localDateToIso,
  todayLocalDate as getTodayLocalDate,
} from "../../core/date.utils";

const money = (value: number): string =>
  new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const moneyNoDecimals = (value: number): string =>
  new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    maximumFractionDigits: 0,
  }).format(value);

const CATEGORY_TONES: Record<string, string> = {
  "Alimentación": "emerald",
  "Transporte": "cyan",
  "Vivienda": "violet",
  "Servicios": "amber",
  "Salud": "red",
  "Ocio": "emerald",
  "Educación": "cyan",
  "Otros": "violet",
};

const DESIGN_CATEGORIES = [
  "Alimentación",
  "Transporte",
  "Educación",
  "Servicios",
  "Vivienda",
  "Salud",
  "Ocio",
  "Otros",
];

interface KpiView {
  icon: "wallet" | "trend-up" | "trend-down" | "percent";
  tone: "emerald" | "cyan" | "red" | "violet";
  label: string;
  value: string;
  arrow: "up" | "down" | null;
  arrowClass: string;
  percent: number | null;
  text: string;
}

interface Trend {
  arrow: "up" | "down" | null;
  arrowClass: string;
  percent: number | null;
}

interface CategoryView {
  name: string;
  raw: number;
  tone: string;
  percent: number;
}

@Component({
  selector: "app-dashboard",
  imports: [FormsModule, RouterLink, RouterLinkActive],
  templateUrl: "./dashboard.html",
  styleUrl: "./dashboard.css",
})
export class Dashboard implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly expenses = inject(ExpensesService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly user = this.auth.user;
  readonly avatarBroken = signal(false);
  readonly summary = signal<DashboardSummary | null>(null);
  loadError = false;

  readonly tipo = signal<"INCOME" | "EXPENSE">("INCOME");
  readonly menuOpen = signal(false);
  amount = "";
  category = "Alimentación";
  date = getTodayLocalDate();
  submitting = false;

  readonly expenseCategories = [
    "Alimentación",
    "Transporte",
    "Educación",
    "Servicios",
    "Vivienda",
    "Salud",
    "Ocio",
    "Otros",
  ];

  readonly kpis = computed<KpiView[]>(() => {
    const data = this.summary();
    const months = data?.monthly ?? [];
    const current = months[months.length - 1];
    const previous = months[months.length - 2];
    const budget = data?.budget;

    const incomeTrend = this.buildTrend(
      current?.income ?? 0,
      previous?.income ?? 0
    );
    const expenseTrend = this.buildTrend(
      current?.expense ?? 0,
      previous?.expense ?? 0,
      true
    );
    const balanceTrend = this.buildTrend(
      (current?.income ?? 0) - (current?.expense ?? 0),
      (previous?.income ?? 0) - (previous?.expense ?? 0)
    );

    return [
      {
        icon: "wallet",
        tone: "emerald",
        label: "Balance total",
        value: money(data?.balance ?? 0),
        ...balanceTrend,
        text: "vs mes anterior",
      },
      {
        icon: "trend-up",
        tone: "cyan",
        label: "Ingresos del mes",
        value: money(data?.incomeMonth ?? 0),
        ...incomeTrend,
        text: "vs mes anterior",
      },
      {
        icon: "trend-down",
        tone: "red",
        label: "Gastos del mes",
        value: money(data?.expenseMonth ?? 0),
        ...expenseTrend,
        text: "vs mes anterior",
      },
      {
        icon: "percent",
        tone: "violet",
        label: "Presupuesto restante",
        value: `${budget?.percent ?? 0}%`,
        arrow: (budget?.remaining ?? 0) > 0 ? "up" : null,
        arrowClass: (budget?.remaining ?? 0) > 0 ? "trend-up" : "trend-info",
        percent: null,
        text: `${moneyNoDecimals(budget?.remaining ?? 0)} disponibles`,
      },
    ];
  });

  readonly categories = computed<CategoryView[]>(() => {
    const raw = this.summary()?.categories ?? [];
    const selected = raw.slice(0, 7).map((item) => ({
      name: item.category,
      raw: item.amount,
      tone: CATEGORY_TONES[item.category] ?? "violet",
      percent: 0,
    }));
    for (const name of DESIGN_CATEGORIES) {
      if (selected.length >= 7) {
        break;
      }
      if (!selected.some((item) => item.name === name)) {
        selected.push({ name, raw: 0, tone: CATEGORY_TONES[name] ?? "violet", percent: 0 });
      }
    }
    const max = Math.max(0, ...selected.map((item) => item.raw));
    for (const item of selected) {
      item.percent = max > 0 ? Math.round((item.raw / max) * 100) : 0;
    }
    return selected;
  });

  readonly alerts = computed(() => this.summary()?.alerts ?? []);

  readonly exceedsIncome = computed(
    () => this.summary()?.exceedsIncome ?? false
  );

  readonly chart = computed<MonthSum[]>(() => this.summary()?.monthly ?? []);

  readonly chartMax = computed(() =>
    Math.max(0, ...this.chart().flatMap((m) => [m.income, m.expense]))
  );

  readonly refreshTick = signal(0);
  readonly chartPulse = computed(() => this.refreshTick() % 2 === 1);

  ngOnInit(): void {
    this.auth.me().subscribe({
      error: () => {
        this.loadError = true;
      },
    });
    this.load();
  }

  load(): void {
    this.expenses.summary().subscribe({
      next: (data) => this.summary.set(data),
      error: () => {
        this.loadError = true;
      },
    });
  }

  money(value: number): string {
    return money(value);
  }

  todayLocalDate(): string {
    return getTodayLocalDate();
  }

  barHeight(value: number): number {
    const max = this.chartMax();
    return max > 0 ? (value / max) * 100 : 0;
  }

  private buildTrend(current: number, previous: number, invert = false): Trend {
    if (previous <= 0 && current <= 0) {
      return { arrow: null, arrowClass: "trend-info", percent: null };
    }
    if (previous <= 0) {
      return { arrow: "up", arrowClass: "trend-up", percent: null };
    }
    const percent = Math.round(((current - previous) / previous) * 100);
    const positive = current - previous >= 0;
    const good = invert ? !positive : positive;
    return {
      arrow: positive ? "up" : "down",
      arrowClass: good ? "trend-up" : "trend-down",
      percent,
    };
  }

  initials(name: string | undefined): string {
    if (!name) {
      return "FB";
    }
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase() || "US";
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  onAvatarError(): void {
    this.avatarBroken.set(true);
  }

  settings(): void {
    this.menuOpen.set(false);
    void this.router.navigate(["/ajustes"]);
  }

  setTipo(value: "INCOME" | "EXPENSE"): void {
    this.tipo.set(value);
  }

  submit(): void {
    const amount = Math.round(Number(this.amount) * 100) / 100;
    if (!amount || amount <= 0) {
      this.toast.error("Ingrese un monto válido para la transacción.", "Monto inválido");
      return;
    }
    if (this.submitting) {
      return;
    }
    this.submitting = true;
    this.http
      .post("/api/expenses", {
        description: this.category,
        amount,
        type: this.tipo(),
        category: this.category,
        date: localDateToIso(this.date),
      })
      .subscribe({
        next: () => {
          const tipo = this.tipo() === "INCOME" ? "Ingreso" : "Egreso";
          this.toast.success(`${tipo} registrado correctamente.`, `${tipo} registrado`);
          this.amount = "";
          this.submitting = false;
          this.load();
          this.refreshTick.update((v) => v + 1);
          setTimeout(() => {
            document
              .querySelector(".chart-panel")
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 150);
        },
        error: (err: HttpErrorResponse) => {
          const message =
            err.status === 0
              ? "No se pudo conectar con el servidor. Intente de nuevo."
              : (err.error?.error as string | undefined) ??
                "No se pudo registrar la transacción. Intente de nuevo.";
          this.toast.error(
            message,
            "Error al registrar"
          );
          this.submitting = false;
        },
      });
  }

  logout(): void {
    this.auth.logout();
  }
}