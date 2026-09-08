import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink, RouterLinkActive, Router } from "@angular/router";
import { AuthService } from "../../core/auth.service";
import { ToastService } from "../../core/toast.service";
import {
  ExpensesService,
  type DashboardSummary,
  type ExpenseItem,
} from "../../core/expenses.service";
import {
  formatDisplayDate,
  localDateToIso,
  todayLocalDate,
} from "../../core/date.utils";

const money = (value: number): string =>
  new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
  }).format(value);

const CATEGORY_TONES: Record<string, string> = {
  "Alimentación": "emerald",
  "Transporte": "cyan",
  "Vivienda": "violet",
  "Servicios": "amber",
  "Salud": "red",
  "Ocio": "emerald",
  "Educación": "cyan",
  "Ropa": "violet",
  "Salario": "emerald",
  "Otros": "violet",
};

const CATEGORY_ICONS: Record<string, string> = {
  "Salario": "wallet",
  "Alimentación": "cart",
  "Servicios": "bulb",
  "Transporte": "bus",
  "Salud": "health",
  "Vivienda": "home",
  "Educación": "book",
  "Ocio": "gamepad",
  "Ropa": "shirt",
  "Otros": "box",
};

interface KpiView {
  icon: "wallet" | "trend-up" | "trend-down" | "list";
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

type Filter = "ALL" | "INCOME" | "EXPENSE";

@Component({
  selector: "app-transacciones",
  standalone: true,
  imports: [FormsModule, RouterLink, RouterLinkActive],
  templateUrl: "./transacciones.html",
  styleUrl: "./transacciones.css",
})
export class Transacciones implements OnInit {
  private readonly toast = inject(ToastService);
  private readonly expenses = inject(ExpensesService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly user = this.auth.user;
  readonly summary = signal<DashboardSummary | null>(null);
  readonly transactions = signal<ExpenseItem[]>([]);
  loadError = false;

  readonly menuOpen = signal(false);
  readonly filter = signal<Filter>("ALL");
  readonly search = signal("");
  loading = false;

  readonly tipo = signal<"INCOME" | "EXPENSE">("EXPENSE");
  amount = "";
  category = "Alimentación";
  description = "";
  date = todayLocalDate();
  submitting = false;

  readonly editing = signal<ExpenseItem | null>(null);
  editTipo: "INCOME" | "EXPENSE" = "EXPENSE";
  editAmount = "";
  editCategory = "Alimentación";
  editDescription = "";
  editDate = "";
  savingEdit = false;

  readonly deleting = signal<ExpenseItem | null>(null);
  deletingTransaction = false;

  readonly incomeCategories = ["Salario", "Trabajo independiente", "Otros ingresos"];
  readonly expenseCategories = [
    "Alimentación",
    "Transporte",
    "Vivienda",
    "Servicios",
    "Salud",
    "Ocio",
    "Educación",
    "Ropa",
    "Otros",
  ];

  readonly kpis = computed<KpiView[]>(() => {
    const data = this.summary();
    const count = this.transactions().length;
    const months = data?.monthly ?? [];
    const current = months[months.length - 1];
    const previous = months[months.length - 2];

    const balanceTrend = this.buildTrend(
      (current?.income ?? 0) - (current?.expense ?? 0),
      (previous?.income ?? 0) - (previous?.expense ?? 0)
    );
    const incomeTrend = this.buildTrend(
      current?.income ?? 0,
      previous?.income ?? 0
    );
    const expenseTrend = this.buildTrend(
      current?.expense ?? 0,
      previous?.expense ?? 0,
      true
    );

    return [
      {
        icon: "wallet",
        tone: "emerald",
        label: "Balance actual",
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
        icon: "list",
        tone: "violet",
        label: "Transacciones",
        value: `${count}`,
        arrow: null,
        arrowClass: "trend-info",
        percent: null,
        text: "Registradas este mes",
      },
    ];
  });

  readonly categories = computed<CategoryView[]>(() => {
    const raw = this.summary()?.categories ?? [];
    const selected = raw.slice(0, 5).map((item) => ({
      name: item.category,
      raw: item.amount,
      tone: CATEGORY_TONES[item.category] ?? "violet",
      percent: 0,
    }));
    for (const name of this.expenseCategories) {
      if (selected.length >= 5) {
        break;
      }
      if (!selected.some((item) => item.name === name)) {
        selected.push({ name, raw: 0, tone: CATEGORY_TONES[name] ?? "violet", percent: 0 });
      }
    }
    const total = Math.max(1, selected.reduce((sum, item) => sum + item.raw, 0));
    for (const item of selected) {
      item.percent = Math.round((item.raw / total) * 100);
    }
    return selected;
  });

  readonly filteredTransactions = computed<ExpenseItem[]>(() => {
    const query = this.search().trim().toLowerCase();
    if (!query) {
      return this.transactions();
    }
    return this.transactions().filter((item) => {
      const haystack =
        `${item.description} ${item.category}`.toLowerCase();
      return haystack.includes(query);
    });
  });

  readonly totalMonth = computed(() => {
    const data = this.summary();
    return (data?.incomeMonth ?? 0) + (data?.expenseMonth ?? 0);
  });

  readonly selectedCategories = computed<string[]>(() =>
    this.tipo() === "INCOME" ? this.incomeCategories : this.expenseCategories
  );

  ngOnInit(): void {
    this.auth.me().subscribe({
      error: () => {
        this.loadError = true;
      },
    });
    this.load();
  }

  load(): void {
    this.loading = true;
    const current = this.filter();
    const type =
      current === "ALL"
        ? undefined
        : (current as "INCOME" | "EXPENSE");
    this.expenses
      .list({ page: 1, limit: 50, type })
      .subscribe({
        next: (data) => {
          this.transactions.set(data.items);
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.loadError = true;
        },
      });
    this.expenses.summary().subscribe({
      next: (data) => this.summary.set(data),
      error: () => {},
    });
  }

  setFilter(value: Filter): void {
    this.filter.set(value);
    this.load();
  }

  money(value: number): string {
    return money(value);
  }

  categoryIcon(category: string): string {
    return CATEGORY_ICONS[category] ?? "box";
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

  formatDate(value: string): string {
    return formatDisplayDate(value);
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

  settings(): void {
    this.menuOpen.set(false);
    void this.router.navigate(["/ajustes"]);
  }

  setTipo(value: "INCOME" | "EXPENSE"): void {
    this.tipo.set(value);
    const list = value === "INCOME" ? this.incomeCategories : this.expenseCategories;
    if (!list.includes(this.category)) {
      this.category = list[0];
    }
  }

  setEditTipo(value: "INCOME" | "EXPENSE"): void {
    this.editTipo = value;
    const list = value === "INCOME" ? this.incomeCategories : this.expenseCategories;
    if (!list.includes(this.editCategory)) {
      this.editCategory = list[0];
    }
  }

  submit(): void {
    const amount = Number(this.amount);
    if (!amount || amount <= 0) {
      this.toast.error("Ingrese un monto válido para la transacción.", "Monto inválido");
      return;
    }
    if (this.submitting) {
      return;
    }
    this.submitting = true;
    this.expenses
      .create({
        description: this.description.trim() || this.category,
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
          this.description = "";
          this.submitting = false;
          this.filter.set("ALL");
          this.load();
        },
        error: () => {
          this.toast.error("No se pudo registrar la transacción. Intente de nuevo.", "Error al registrar");
          this.submitting = false;
        },
      });
  }

  logout(): void {
    this.auth.logout();
  }

  openEdit(item: ExpenseItem): void {
    this.editTipo = item.type;
    this.editAmount = String(item.amount);
    this.editCategory = item.category;
    this.editDescription = item.description;
    this.editDate = item.date.slice(0, 10);
    this.editing.set(item);
  }

  closeEdit(): void {
    this.editing.set(null);
  }

  saveEdit(): void {
    const item = this.editing();
    if (!item) {
      return;
    }
    const amount = Number(this.editAmount);
    if (!amount || amount <= 0) {
      this.toast.error("Ingrese un monto válido para la transacción.", "Monto inválido");
      return;
    }
    if (this.savingEdit) {
      return;
    }
    this.savingEdit = true;
    this.expenses
      .update(item.id, {
        description: this.editDescription.trim() || this.editCategory,
        amount,
        type: this.editTipo,
        category: this.editCategory,
        date: localDateToIso(this.editDate),
      })
      .subscribe({
        next: () => {
          this.toast.success("La transacción se actualizó correctamente.", "Transacción actualizada");
          this.savingEdit = false;
          this.editing.set(null);
          this.load();
        },
        error: () => {
          this.toast.error("No se pudo actualizar la transacción. Intente de nuevo.", "Error al actualizar");
          this.savingEdit = false;
        },
      });
  }

  confirmDelete(item: ExpenseItem): void {
    this.deleting.set(item);
  }

  cancelDelete(): void {
    this.deleting.set(null);
  }

  deleteTransaction(): void {
    const item = this.deleting();
    if (!item) {
      return;
    }
    if (this.deletingTransaction) {
      return;
    }
    this.deletingTransaction = true;
    this.expenses.remove(item.id).subscribe({
      next: () => {
        this.toast.success("La transacción se eliminó permanentemente.", "Transacción eliminada");
        this.deletingTransaction = false;
        this.deleting.set(null);
        this.load();
      },
      error: () => {
        this.toast.error("No se pudo eliminar la transacción. Intente de nuevo.", "Error al eliminar");
        this.deletingTransaction = false;
      },
    });
  }
}
