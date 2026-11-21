import { Router } from 'express';
import {
  changePasswordHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  registerHandler,
  updateProfileHandler,
} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/authenticate';
import { validate } from '../middlewares/validate';
import {
  changePasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  updateProfileSchema,
} from '../validations/auth.validation';

const router = Router();

router.post('/register', validate({ body: registerSchema }), registerHandler);
router.post('/login', validate({ body: loginSchema }), loginHandler);
router.post('/refresh', validate({ body: refreshSchema }), refreshHandler);
router.post('/logout', validate({ body: refreshSchema }), logoutHandler);
router.get('/me', authenticate, meHandler);
router.patch('/me', authenticate, validate({ body: updateProfileSchema }), updateProfileHandler);
router.patch(
  '/me/password',
  authenticate,
  validate({ body: changePasswordSchema }),
  changePasswordHandler,
);

export default router;
