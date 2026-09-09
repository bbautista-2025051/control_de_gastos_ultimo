import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { prisma } from "../../../lib/prisma";
import { env } from "../../../config/env";
import { HttpError } from "../../../lib/errors";
import type { AuthPayload } from "../../../middlewares/auth.middleware";
import type {
  ChangePasswordInput,
  GoogleLoginInput,
  LoginInput,
  UpdateProfileInput,
} from "../auth.schemas";

const TOKEN_EXPIRATION = "30m";

const googleJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  createdAt: Date;
  passwordHash: string | null;
};

function toSafeUser(
  user: PublicUser & { isActive?: boolean; googleId?: string | null }
) {
  const { passwordHash, isActive, ...rest } = user;
  void passwordHash;
  void isActive;
  return { ...rest, hasPassword: user.passwordHash != null };
}

export class AuthService {
  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        ...publicUserSelect,
        isActive: true,
        passwordHash: true,
      },
    });

    const isValid =
      user?.passwordHash != null &&
      (await bcrypt.compare(input.password, user.passwordHash));

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

    const safeUser = toSafeUser(user);

    return { token, user: safeUser };
  }

  async googleLogin(input: GoogleLoginInput) {
    let payload: Record<string, unknown>;
    try {
      const { payload: verified } = await jwtVerify(
        input.credential,
        googleJwks,
        { issuer: ["https://accounts.google.com", "accounts.google.com"] }
      );
      payload = verified as Record<string, unknown>;
    } catch {
      throw new HttpError(401, "Credencial de Google inválida.");
    }

    const googleId = payload.sub as string;
    const email = payload.email as string;
    const name = (payload.name as string) ?? email;

    if (!googleId || !email) {
      throw new HttpError(401, "Credencial de Google inválida.");
    }

    let user = await prisma.user.findUnique({
      where: { googleId },
      select: { ...publicUserSelect, isActive: true, passwordHash: true },
    });

    if (!user) {
      user = await prisma.user.findUnique({
        where: { email },
        select: { ...publicUserSelect, isActive: true, googleId: true, passwordHash: true },
      });

      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId },
          select: { ...publicUserSelect, isActive: true, passwordHash: true },
        });
      } else {
        user = await prisma.user.create({
          data: {
            name,
            email,
            googleId,
          },
          select: { ...publicUserSelect, isActive: true, passwordHash: true },
        });
      }
    }

    if (!user.isActive) {
      throw new HttpError(403, "Tu cuenta está desactivada.");
    }

    const authPayload: AuthPayload = { userId: user.id, role: user.role };
    const token = jwt.sign(authPayload, env.jwtSecret, {
      expiresIn: TOKEN_EXPIRATION,
    });

    const safeUser = toSafeUser(user);

    return { token, user: safeUser };
  }

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { ...publicUserSelect, passwordHash: true },
    });

    if (!user) {
      throw new HttpError(404, "Usuario no encontrado.");
    }

    return toSafeUser(user);
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

    if (!user.passwordHash) {
      throw new HttpError(400, "Esta cuenta usa Google, selecciona tu contraseña desde el perfil.");
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