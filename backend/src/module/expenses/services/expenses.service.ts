import type { Role } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";
import { HttpError } from "../../../lib/errors";
import type {
  CreateExpenseInput,
  ListExpensesQuery,
  UpdateExpenseInput,
} from "../expenses.schemas";

const expenseSelect = {
  id: true,
  description: true,
  amount: true,
  type: true,
  category: true,
  date: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const MONTH_LABELS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
] as const;

// Presupuesto mensual por categoría (misma fuente que la vista de Categorías).
const CATEGORY_BUDGETS: Record<string, number> = {
  "Alimentación": 700,
  "Transporte": 450,
  "Vivienda": 1200,
  "Servicios": 400,
  "Salud": 300,
  "Ocio": 150,
  "Educación": 250,
  "Ropa": 150,
  "Otros": 100,
};

const TOTAL_BUDGET = Object.values(CATEGORY_BUDGETS).reduce((a, b) => a + b, 0);

export class ExpensesService {
  isAdmin(role: Role) {
    return role === "ADMIN";
  }

  async summary(actor: { userId: string; role: Role }) {
    const where = this.isAdmin(actor.role) ? {} : { userId: actor.userId };

    const expenses = await prisma.expense.findMany({
      where,
      select: { amount: true, type: true, date: true, category: true },
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    let balance = 0;
    let incomeMonth = 0;
    let expenseMonth = 0;
    const categorySums = new Map<string, number>();

    for (const expense of expenses) {
      const amount = Number(expense.amount);
      const isIncome = expense.type === "INCOME";
      balance += isIncome ? amount : -amount;

      if (expense.date >= monthStart) {
        if (isIncome) incomeMonth += amount;
        else {
          expenseMonth += amount;
          categorySums.set(
            expense.category,
            (categorySums.get(expense.category) ?? 0) + amount
          );
        }
      }
    }

    const monthly = [];
    for (let offset = 5; offset >= 0; offset--) {
      const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const end =
        offset === 0
          ? now
          : new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);

      let income = 0;
      let expense = 0;
      for (const item of expenses) {
        if (item.date >= start && item.date < end) {
          const amount = Number(item.amount);
          if (item.type === "INCOME") income += amount;
          else expense += amount;
        }
      }
      monthly.push({ label: MONTH_LABELS[start.getMonth()], income, expense });
    }

    const categories = Array.from(categorySums.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    const remaining = Math.max(0, TOTAL_BUDGET - expenseMonth);
    const budgetPercent =
      TOTAL_BUDGET > 0
        ? Math.max(0, Math.round((remaining / TOTAL_BUDGET) * 100))
        : 0;

    const alerts = Array.from(categorySums.entries())
      .map(([category, spent]) => {
        const limit = CATEGORY_BUDGETS[category];
        if (!limit) return null;
        return {
          category,
          spent,
          limit,
          percent: Math.round((spent / limit) * 100),
        };
      })
      .filter(
        (item): item is { category: string; spent: number; limit: number; percent: number } =>
          item !== null && item.percent >= 80
      )
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 4);

    return {
      balance,
      incomeMonth,
      expenseMonth,
      budget: {
        limit: TOTAL_BUDGET,
        spent: expenseMonth,
        remaining,
        percent: budgetPercent,
      },
      categories,
      categoryBudgets: CATEGORY_BUDGETS,
      monthly,
      alerts,
    };
  }

  async list(actor: { userId: string; role: Role }, query: ListExpensesQuery) {
    const { page, limit, category, type, from, to } = query;

    const where = {
      ...(this.isAdmin(actor.role) ? {} : { userId: actor.userId }),
      ...(category ? { category } : {}),
      ...(type ? { type } : {}),
      ...(from || to
        ? { date: { gte: from, lte: to } }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.expense.findMany({
        where,
        select: expenseSelect,
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.expense.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getById(actor: { userId: string; role: Role }, id: string) {
    const expense = await prisma.expense.findUnique({
      where: { id },
      select: expenseSelect,
    });

    if (!expense || (!this.isAdmin(actor.role) && expense.userId !== actor.userId)) {
      throw new HttpError(404, "Registro no encontrado.");
    }

    return expense;
  }

  async create(actor: { userId: string }, input: CreateExpenseInput) {
    return prisma.expense.create({
      data: {
        description: input.description,
        amount: input.amount,
        type: input.type,
        category: input.category,
        date: input.date,
        userId: actor.userId,
      },
      select: expenseSelect,
    });
  }

  async update(
    actor: { userId: string; role: Role },
    id: string,
    input: UpdateExpenseInput
  ) {
    const existing = await this.getById(actor, id);

    return prisma.expense.update({
      where: { id: existing.id },
      data: input,
      select: expenseSelect,
    });
  }

  async remove(actor: { userId: string; role: Role }, id: string) {
    const existing = await this.getById(actor, id);
    await prisma.expense.delete({ where: { id: existing.id } });
    return { message: "Registro eliminado." };
  }
}