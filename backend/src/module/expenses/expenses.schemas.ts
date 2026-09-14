import { z } from "zod";

// Categorías predefinidas de fábrica (plan: el usuario no puede crearlas, modificarlas ni eliminarlas)
export const EXPENSE_CATEGORIES = [
  "Alimentación",
  "Transporte",
  "Vivienda",
  "Servicios",
  "Salud",
  "Ocio",
  "Educación",
  "Ropa",
  "Otros",
] as const;

export const INCOME_CATEGORIES = [
  "Salario",
  "Trabajo independiente",
  "Otros ingresos",
] as const;

export const ALL_CATEGORIES = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

const categorySets: Record<"INCOME" | "EXPENSE", readonly string[]> = {
  INCOME: INCOME_CATEGORIES,
  EXPENSE: EXPENSE_CATEGORIES,
};

const dateSchema = z.coerce.date({ error: "Fecha inválida." });
const optionalDateSchema = dateSchema.optional();

export const createExpenseSchema = z.object({
  description: z
    .string({ error: "Ingresa una descripción." })
    .trim()
    .min(2, { error: "La descripción debe tener al menos 2 caracteres." })
    .max(200, { error: "La descripción no puede superar 200 caracteres." }),
  amount: z
    .number({ error: "Ingresa un monto." })
    .positive("El monto debe ser mayor a 0.")
    .multipleOf(0.01, "El monto no puede tener más de 2 decimales."),
  type: z.enum(["INCOME", "EXPENSE"]).default("EXPENSE"),
  category: z.enum(ALL_CATEGORIES, {
    error: `Categoría inválida. Válidas: ${ALL_CATEGORIES.join(", ")}.`,
  }),
  date: optionalDateSchema,
}).superRefine((data, ctx) => {
  const valid = categorySets[data.type];
  if (valid && !valid.includes(data.category)) {
    ctx.addIssue({
      code: "custom",
      path: ["category"],
      message: `La categoría "${data.category}" no corresponde al tipo ${data.type === "INCOME" ? "ingreso" : "gasto"}.`,
    });
  }
});

export const updateExpenseSchema = z
  .object({
    description: z
      .string({ error: "Ingresa una descripción." })
      .trim()
      .min(2, { error: "La descripción debe tener al menos 2 caracteres." })
      .max(200, { error: "La descripción no puede superar 200 caracteres." }),
    amount: z
      .number({ error: "Ingresa un monto." })
      .positive("El monto debe ser mayor a 0.")
      .multipleOf(0.01, "El monto no puede tener más de 2 decimales."),
    type: z.enum(["INCOME", "EXPENSE"]),
    category: z.enum(ALL_CATEGORIES, {
      error: `Categoría inválida. Válidas: ${ALL_CATEGORIES.join(", ")}.`,
    }),
    date: dateSchema,
  })
  .partial()
  .superRefine((data, ctx) => {
    if (data.type && data.category) {
      const valid = categorySets[data.type];
      if (valid && !valid.includes(data.category)) {
        ctx.addIssue({
          code: "custom",
          path: ["category"],
          message: `La categoría "${data.category}" no corresponde al tipo ${data.type === "INCOME" ? "ingreso" : "gasto"}.`,
        });
      }
    }
  });

function isFutureDate(date: Date): boolean {
  const now = new Date();
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  );
  return date.getTime() > endOfToday.getTime();
}

export const listExpensesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  category: z.enum(ALL_CATEGORIES).optional(),
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ListExpensesQuery = z.infer<typeof listExpensesSchema>;