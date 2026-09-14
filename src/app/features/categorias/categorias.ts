import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { RouterLink, RouterLinkActive, Router } from "@angular/router";
import { AuthService } from "../../core/auth.service";
import {
  ExpensesService,
  type DashboardSummary,
  type ExpenseItem,
} from "../../core/expenses.service";

const money = (value: number): string =>
  new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export interface ExpenseCategory {
  name: string;
  icon: string;
  color: string;
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { name: "Alimentación", icon: "cutlery", color: "#f5a524" },
  { name: "Transporte", icon: "car", color: "#38bdf8" },
  { name: "Vivienda", icon: "home", color: "#2dd4bf" },
  { name: "Servicios", icon: "bolt", color: "#60a5fa" },
  { name: "Salud", icon: "heart", color: "#f76a7a" },
  { name: "Educación", icon: "book", color: "#a78bfa" },
  { name: "Ocio", icon: "film", color: "#f472b6" },
  { name: "Ropa", icon: "shirt", color: "#f59e0b" },
  { name: "Otros", icon: "dots", color: "#94a3b8" },
];

export interface IncomeCategory {
  name: string;
  icon: string;
  color: string;
}

export const INCOME_CATEGORIES: IncomeCategory[] = [
  { name: "Salario", icon: "briefcase", color: "#34d399" },
  { name: "Trabajo independiente", icon: "laptop", color: "#38bdf8" },
  { name: "Otros ingresos", icon: "gift", color: "#a78bfa" },
];

interface ExpenseCardView extends ExpenseCategory {
  budget: number;
  spent: number;
  available: number;
  percent: number;
  over: boolean;
}

@Component({
  selector: "app-categorias",
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: "./categorias.html",
  styleUrl: "./categorias.css",
})
export class Categorias implements OnInit {
  private readonly expenses = inject(ExpensesService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly user = this.auth.user;
  readonly avatarBroken = signal(false);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly incomeTransactions = signal<ExpenseItem[]>([]);
  loadError = false;

  readonly menuOpen = signal(false);
  readonly view = signal<"GASTOS" | "INGRESOS">("GASTOS");

  readonly expenseCategories = EXPENSE_CATEGORIES;
  readonly incomeCategories = INCOME_CATEGORIES;

  readonly totalBudget = computed(
    () => this.summary()?.incomeMonth ?? 0
  );

  readonly spentMonth = computed(
    () => this.summary()?.expenseMonth ?? 0
  );

  readonly availableMonth = computed(() =>
    Math.max(0, this.totalBudget() - this.spentMonth())
  );

  readonly exceedsIncome = computed(() => {
    const data = this.summary();
    return data ? data.exceedsIncome : false;
  });

  readonly expenseCards = computed<ExpenseCardView[]>(() => {
    const data = this.summary();
    const byName = new Map(
      (data?.categories ?? []).map((c) => [c.category, c.amount])
    );
    const budgets = data?.categoryBudgets ?? {};
    return EXPENSE_CATEGORIES.map((cat) => {
      const budget = budgets[cat.name] ?? 0;
      const spent = byName.get(cat.name) ?? 0;
      const available = Math.max(0, budget - spent);
      const percent =
        budget > 0 ? Math.round((spent / budget) * 100) : 0;
      return { ...cat, budget, spent, available, percent, over: spent > budget };
    });
  });

  readonly incomeCards = computed(() =>
    INCOME_CATEGORIES.map((cat) => ({
      ...cat,
      received: this.incomeTransactions()
        .filter((t) => t.category === cat.name && this.isThisMonth(t.date))
        .reduce((sum, t) => sum + t.amount, 0),
    }))
  );

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
    this.expenses.list({ type: "INCOME", limit: 50 }).subscribe({
      next: (data) => this.incomeTransactions.set(data.items),
      error: () => {},
    });
  }

  private isThisMonth(dateStr: string): boolean {
    const date = new Date(dateStr);
    const now = new Date();
    return (
      !Number.isNaN(date.getTime()) &&
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }

  setView(value: "GASTOS" | "INGRESOS"): void {
    this.view.set(value);
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

  onAvatarError(): void {
    this.avatarBroken.set(true);
  }

  settings(): void {
    this.menuOpen.set(false);
    void this.router.navigate(["/ajustes"]);
  }

  logout(): void {
    this.auth.logout();
  }
}
