import { z } from "zod";

const nameSchema = z
  .string({ error: "Ingresa un nombre." })
  .trim()
  .min(2, { error: "El nombre debe tener al menos 2 caracteres." })
  .max(100, { error: "El nombre no puede superar 100 caracteres." });

const emailSchema = z
  .email({ error: "Ingresa un correo electrónico válido." })
  .trim();

const passwordSchema = z
  .string({ error: "Ingresa una contraseña." })
  .min(8, { error: "La contraseña debe tener al menos 8 caracteres." })
  .regex(/[A-Z]/, { error: "La contraseña debe incluir una mayúscula." })
  .regex(/[a-z]/, { error: "La contraseña debe incluir una minúscula." })
  .regex(/\d/, { error: "La contraseña debe incluir un número." });

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: "Ingresa su contraseña." })
    .min(1, { error: "Ingresa su contraseña." }),
});

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z
      .string({ error: "Confirma tu contraseña." })
      .min(1, { error: "Confirma tu contraseña." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

export const updateProfileSchema = z
  .object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.email !== undefined, {
    message: "No hay cambios que guardar.",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: "Ingresa tu contraseña actual." })
      .min(1, { error: "Ingresa tu contraseña actual." }),
    newPassword: passwordSchema,
    confirmPassword: z.string({
      error: "Confirma tu nueva contraseña.",
    }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

export const googleLoginSchema = z.object({
  credential: z
    .string({ error: "Credencial de Google requerida." })
    .min(1, { error: "Credencial de Google requerida." }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;