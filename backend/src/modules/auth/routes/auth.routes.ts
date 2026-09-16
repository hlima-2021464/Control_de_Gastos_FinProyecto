import { Router } from 'express';
import { loginHandler, refreshTokenHandler } from '../controllers/auth.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';

const router: Router = Router();

/**
 * @route  POST /api/auth/login
 * @desc   Autenticar usuario y obtener token JWT
 * @access Public
 */
router.post('/login', loginHandler);

/**
 * @route  POST /api/auth/refresh
 * @desc   Renovar token JWT por actividad del usuario
 * @access Private
 */
router.post('/refresh', authMiddleware, refreshTokenHandler);

export default router;
