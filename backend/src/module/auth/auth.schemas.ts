import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .email({ error: "Ingresa un correo electrónico válido." })
    .trim(),
  password: z
    .string({ error: "Ingresa su contraseña." })
    .min(1, { error: "Ingresa su contraseña." }),
});

export const updateProfileSchema = z
  .object({
    name: z
      .string({ error: "Ingresa un nombre." })
      .trim()
      .min(2, { error: "El nombre debe tener al menos 2 caracteres." })
      .max(100, { error: "El nombre no puede superar 100 caracteres." })
      .optional(),
    email: z
      .email({ error: "Ingresa un correo electrónico válido." })
      .trim()
      .optional(),
  })
  .refine((data) => data.name !== undefined || data.email !== undefined, {
    message: "No hay cambios que guardar.",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: "Ingresa tu contraseña actual." })
      .min(1, { error: "Ingresa tu contraseña actual." }),
    newPassword: z
      .string({ error: "Ingresa tu nueva contraseña." })
      .min(8, {
        error: "La nueva contraseña debe tener al menos 8 caracteres.",
      })
      .regex(/[A-Z]/, {
        error: "La nueva contraseña debe incluir una mayúscula.",
      })
      .regex(/[a-z]/, {
        error: "La nueva contraseña debe incluir una minúscula.",
      })
      .regex(/\d/, {
        error: "La nueva contraseña debe incluir un número.",
      }),
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
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;