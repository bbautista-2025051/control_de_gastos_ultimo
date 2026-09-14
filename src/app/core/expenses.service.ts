import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { map } from "rxjs";

export interface CategorySum {
  category: string;
  amount: number;
}

export interface MonthSum {
  label: string;
  income: number;
  expense: number;
}

export interface BudgetSummary {
  limit: number;
  spent: number;
  remaining: number;
  percent: number;
}

export interface BudgetAlert {
  category: string;
  percent: number;
  spent: number;
  limit: number;
}

export interface DashboardSummary {
  balance: number;
  incomeMonth: number;
  expenseMonth: number;
  exceedsIncome: boolean;
  budget: BudgetSummary;
  categories: CategorySum[];
  categoryBudgets: Record<string, number>;
  categoryBudgetPercents: Record<string, number>;
  monthly: MonthSum[];
  alerts: BudgetAlert[];
}

export interface ExpenseItem {
  id: string;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string;
  date: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseListResponse {
  items: ExpenseItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ListExpensesParams {
  page?: number;
  limit?: number;
  type?: "INCOME" | "EXPENSE";
  category?: string;
}

@Injectable({ providedIn: "root" })
export class ExpensesService {
  private readonly http = inject(HttpClient);

  summary() {
    return this.http.get<DashboardSummary>("/api/expenses/summary");
  }

  list(params: ListExpensesParams = {}) {
    const query: Record<string, string | number> = {};
    if (params.page !== undefined) {
      query["page"] = params.page;
    }
    if (params.limit !== undefined) {
      query["limit"] = params.limit;
    }
    if (params.type !== undefined) {
      query["type"] = params.type;
    }
    if (params.category !== undefined) {
      query["category"] = params.category;
    }
    return this.http.get<ExpenseListResponse>("/api/expenses", { params: query }).pipe(
      map((res) => ({
        ...res,
        items: res.items.map((item) => ({ ...item, amount: Number(item.amount) })),
      }))
    );
  }

  create(input: {
    description: string;
    amount: number;
    type: "INCOME" | "EXPENSE";
    category: string;
    date?: string;
  }) {
    return this.http.post<{ expense: ExpenseItem }>("/api/expenses", input);
  }

  update(
    id: string,
    input: {
      description?: string;
      amount?: number;
      type?: "INCOME" | "EXPENSE";
      category?: string;
      date?: string;
    }
  ) {
    return this.http.patch<{ expense: ExpenseItem }>(
      `/api/expenses/${id}`,
      input
    );
  }

  remove(id: string) {
    return this.http.delete<{ message: string }>(`/api/expenses/${id}`);
  }
}