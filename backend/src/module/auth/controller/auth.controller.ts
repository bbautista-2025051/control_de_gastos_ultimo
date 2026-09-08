import type { NextFunction, Request, Response } from "express";
import type { AuthService } from "../services/auth.service";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.login(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.authService.me(req.auth!.userId);
      res.json({ user });
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.authService.updateProfile(
        req.auth!.userId,
        req.body
      );
      res.json({ user });
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.changePassword(
        req.auth!.userId,
        req.body
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  logout = async (_req: Request, res: Response) => {
    res.json({ message: "Sesión cerrada." });
  };
}