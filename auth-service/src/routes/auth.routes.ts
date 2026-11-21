import { Router } from 'express';
import {
  changePasswordHandler,
  forgotPasswordHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  registerHandler,
  resendVerificationHandler,
  resetPasswordHandler,
  updateProfileHandler,
  verifyEmailHandler,
} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/authenticate';
import { validate } from '../middlewares/validate';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '../validations/auth.validation';

const router = Router();

router.post('/register', validate({ body: registerSchema }), registerHandler);
router.post('/login', validate({ body: loginSchema }), loginHandler);
router.post('/refresh', validate({ body: refreshSchema }), refreshHandler);
router.post('/logout', validate({ body: refreshSchema }), logoutHandler);
router.post('/verify-email', validate({ body: verifyEmailSchema }), verifyEmailHandler);
router.post('/resend-verification', authenticate, resendVerificationHandler);
router.post('/forgot-password', validate({ body: forgotPasswordSchema }), forgotPasswordHandler);
router.post('/reset-password', validate({ body: resetPasswordSchema }), resetPasswordHandler);
router.get('/me', authenticate, meHandler);
router.patch('/me', authenticate, validate({ body: updateProfileSchema }), updateProfileHandler);
router.patch(
  '/me/password',
  authenticate,
  validate({ body: changePasswordSchema }),
  changePasswordHandler,
);

export default router;
