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

// Presupuesto por categoría: % de los ingresos del mes.
// Los gastos no son fijos: el presupuesto total equivale a los ingresos del mes
// y cada categoría recibe un porcentaje de ellos.
const CATEGORY_BUDGET_PERCENTS: Record<string, number> = {
  "Vivienda": 30,
  "Alimentación": 20,
  "Transporte": 15,
  "Servicios": 10,
  "Salud": 10,
  "Educación": 5,
  "Ocio": 5,
  "Ropa": 3,
  "Otros": 2,
};

const PERCENT_TOTAL = Object.values(CATEGORY_BUDGET_PERCENTS).reduce(
  (a, b) => a + b,
  0
);

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

    // El presupuesto total equivale a los ingresos del mes. Cada categoría recibe
    // un porcentaje de esos ingresos. Si no hay ingresos registrados, no hay
    // presupuesto disponible.
    const categoryBudgets: Record<string, number> = {};
    for (const [category, percent] of Object.entries(CATEGORY_BUDGET_PERCENTS)) {
      categoryBudgets[category] = Math.round(incomeMonth * percent) / 100;
    }

    const totalLimit = Math.round(incomeMonth * 100) / 100;
    const remaining = Math.max(0, totalLimit - expenseMonth);
    const budgetPercent =
      totalLimit > 0
        ? Math.max(0, Math.round((remaining / totalLimit) * 100))
        : 0;

    const exceedsIncome = expenseMonth > totalLimit;

    const alerts = Array.from(categorySums.entries())
      .map(([category, spent]) => {
        const limit = categoryBudgets[category];
        if (!limit || limit <= 0) return null;
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
      exceedsIncome,
      budget: {
        limit: totalLimit,
        spent: expenseMonth,
        remaining,
        percent: budgetPercent,
      },
      categories,
      categoryBudgets,
      categoryBudgetPercents: CATEGORY_BUDGET_PERCENTS,
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