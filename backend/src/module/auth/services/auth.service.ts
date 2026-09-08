import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../../../lib/prisma";
import { env } from "../../../config/env";
import { HttpError } from "../../../lib/errors";
import type { AuthPayload } from "../../../middlewares/auth.middleware";
import type {
  ChangePasswordInput,
  LoginInput,
  UpdateProfileInput,
} from "../auth.schemas";

const TOKEN_EXPIRATION = "30m";

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

export class AuthService {
  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        passwordHash: true,
      },
    });

    const isValid =
      user && (await bcrypt.compare(input.password, user.passwordHash));

    if (!user || !isValid) {
      throw new HttpError(401, "Credenciales incorrectas.");
    }

    if (!user.isActive) {
      throw new HttpError(403, "Tu cuenta está desactivada.");
    }

    const payload: AuthPayload = { userId: user.id, role: user.role };
    const token = jwt.sign(payload, env.jwtSecret, {
      expiresIn: TOKEN_EXPIRATION,
    });

    const { passwordHash: _passwordHash, isActive: _isActive, ...safeUser } = user;
    void _passwordHash;
    void _isActive;

    return { token, user: safeUser };
  }

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });

    if (!user) {
      throw new HttpError(404, "Usuario no encontrado.");
    }

    return user;
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new HttpError(404, "Usuario no encontrado.");
    }

    if (input.email) {
      const existing = await prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });

      if (existing && existing.id !== userId) {
        throw new HttpError(409, "Ese correo electrónico ya está en uso.");
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      select: publicUserSelect,
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
      },
    });

    return updated;
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new HttpError(404, "Usuario no encontrado.");
    }

    const isValid = await bcrypt.compare(
      input.currentPassword,
      user.passwordHash
    );

    if (!isValid) {
      throw new HttpError(400, "La contraseña actual no es correcta.");
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: "Contraseña actualizada correctamente." };
  }
}