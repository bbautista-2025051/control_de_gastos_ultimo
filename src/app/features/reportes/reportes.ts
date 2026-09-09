import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { RouterLink, RouterLinkActive, Router } from "@angular/router";
import { AuthService } from "../../core/auth.service";
import {
  ExpensesService,
  type DashboardSummary,
} from "../../core/expenses.service";
import { EXPENSE_CATEGORIES } from "../categorias/categorias";

const money = (value: number): string =>
  new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
  }).format(value);

type Period = "MES" | "6MESES" | "ANIO";

interface ReportKpi {
  icon: string;
  tone: "emerald" | "red" | "violet" | "teal";
  label: string;
  value: string;
  sub: string;
  subClass: string;
}

interface MonthBar {
  label: string;
  income: number;
  expense: number;
}

interface DetailRow {
  name: string;
  color: string;
  movements: number;
  amount: number;
  percent: number;
}

const MONTH_LABELS = ["Abr", "May", "Jun", "Jul", "Ago", "Sep"];

const FIXED_MONTH_BARS: MonthBar[] = MONTH_LABELS.map((label) => ({
  label,
  income: 0,
  expense: 0,
}));

@Component({
  selector: "app-reportes",
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: "./reportes.html",
  styleUrl: "./reportes.css",
})
export class Reportes implements OnInit {
  private readonly expenses = inject(ExpensesService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly user = this.auth.user;
  readonly summary = signal<DashboardSummary | null>(null);
  loadError = false;

  readonly menuOpen = signal(false);
  readonly period = signal<Period>("6MESES");

  readonly expenseCategories = EXPENSE_CATEGORIES;

  readonly kpis = computed<ReportKpi[]>(() => {
    const data = this.summary();
    const months = data?.monthly ?? [];
    let income = 0;
    let expense = 0;
    if (this.period() === "MES") {
      const cur = months[months.length - 1];
      income = cur?.income ?? 0;
      expense = cur?.expense ?? 0;
    } else {
      income = months.reduce((s, m) => s + (m.income ?? 0), 0);
      expense = months.reduce((s, m) => s + (m.expense ?? 0), 0);
    }
    const balance = income - expense;
    const topCategory = data?.categories?.[0];
    return [
      {
        icon: "trend-up",
        tone: "emerald",
        label: "Ingresos totales",
        value: money(income),
        sub: "vs. periodo anterior",
        subClass: "kpi-sub",
      },
      {
        icon: "trend-down",
        tone: "red",
        label: "Egresos totales",
        value: money(expense),
        sub: "vs. periodo anterior",
        subClass: "kpi-sub",
      },
      {
        icon: "balance",
        tone: "violet",
        label: "Balance neto",
        value: money(balance),
        sub: "vs. periodo anterior",
        subClass: "kpi-sub",
      },
      {
        icon: "bars",
        tone: "teal",
        label: "Categoría con más gasto",
        value: topCategory
          ? `${topCategory.category}: ${money(topCategory.amount)}`
          : "Sin datos",
        sub: topCategory ? "del mes actual" : "Registre transacciones",
        subClass: topCategory ? "kpi-sub" : "kpi-sub-muted",
      },
    ];
  });

  readonly chartBars = computed<MonthBar[]>(() => {
    const months = this.summary()?.monthly ?? [];
    if (this.period() !== "6MESES" || months.length === 0) {
      return FIXED_MONTH_BARS;
    }
    return months.map((m, i) => ({
      label: MONTH_LABELS[i] ?? m.label,
      income: m.income ?? 0,
      expense: m.expense ?? 0,
    }));
  });

  readonly chartMax = computed(() =>
    Math.max(0, ...this.chartBars().flatMap((m) => [m.income, m.expense]))
  );

  readonly donutTotal = computed(() => {
    const data = this.summary();
    const byName = new Map(
      (data?.categories ?? []).map((c) => [c.category, c.amount])
    );
    let total = 0;
    for (const cat of EXPENSE_CATEGORIES) {
      total += byName.get(cat.name) ?? 0;
    }
    return total;
  });

  readonly donutSegments = computed(() => {
    const data = this.summary();
    const byName = new Map(
      (data?.categories ?? []).map((c) => [c.category, c.amount])
    );
    const circumference = 2 * Math.PI * 15.9;
    const total = Math.max(1, this.donutTotal());
    let acc = 0;
    return EXPENSE_CATEGORIES.map((cat) => {
      const amount = byName.get(cat.name) ?? 0;
      const length = (amount / total) * circumference;
      const seg = {
        name: cat.name,
        color: cat.color,
        amount,
        percent: Math.round((amount / total) * 100),
        dash: `${length} ${circumference - length}`
          .replace(/\s+/g, " ")
          .trim(),
        offset: circumference - acc,
      };
      acc += length;
      return seg;
    });
  });

  readonly detailRows = computed<DetailRow[]>(() => {
    const data = this.summary();
    const byName = new Map(
      (data?.categories ?? []).map((c) => [c.category, c.amount])
    );
    const byCount = new Map<string, number>();
    for (const row of data?.categories ?? []) {
      byCount.set(row.category, (byCount.get(row.category) ?? 0) + 1);
    }
    const total = Math.max(1, this.donutTotal());
    return EXPENSE_CATEGORIES.map((cat) => {
      const amount = byName.get(cat.name) ?? 0;
      return {
        name: cat.name,
        color: cat.color,
        movements: byCount.get(cat.name) ?? 0,
        amount,
        percent: amount > 0 ? Math.round((amount / total) * 100) : 0,
      };
    });
  });

  readonly hasTransactions = computed(() => this.donutTotal() > 0);

  ngOnInit(): void {
    this.auth.me().subscribe({
      error: () => {
        this.loadError = true;
      },
    });
    this.expenses.summary().subscribe({
      next: (data) => this.summary.set(data),
      error: () => {
        this.loadError = true;
      },
    });
  }

  setPeriod(value: Period): void {
    this.period.set(value);
  }

  barHeight(value: number): number {
    const max = this.chartMax();
    return max > 0 ? (value / max) * 100 : 0;
  }

  money(value: number): string {
    return money(value);
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
    void this.router.navigate(["/ajustes"]);
  }

  logout(): void {
    this.auth.logout();
  }
}
