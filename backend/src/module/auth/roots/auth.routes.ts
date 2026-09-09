import { Router } from "express";
import { AuthController } from "../controller/auth.controller";
import { AuthService } from "../services/auth.service";
import {
  loginSchema,
  googleLoginSchema,
  updateProfileSchema,
  changePasswordSchema,
} from "../auth.schemas";
import { requireAuth } from "../../../middlewares/auth.middleware";
import { validate } from "../../../lib/validate";

export function authRoutes(): Router {
  const router = Router();
  const authService = new AuthService();
  const authController = new AuthController(authService);

  router.post("/login", validate(loginSchema), authController.login);
  router.post("/google", validate(googleLoginSchema), authController.googleLogin);
  router.get("/me", requireAuth, authController.me);
  router.patch("/me", requireAuth, validate(updateProfileSchema), authController.updateProfile);
  router.post("/change-password", requireAuth, validate(changePasswordSchema), authController.changePassword);
  router.post("/logout", requireAuth, authController.logout);

  return router;
}