import { Router } from 'express';
import {
  loginHandler,
  meHandler,
  refreshHandler,
  registerHandler,
} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/authenticate';
import { validate } from '../middlewares/validate';
import { loginSchema, refreshSchema, registerSchema } from '../validations/auth.validation';

const router = Router();

router.post('/register', validate({ body: registerSchema }), registerHandler);
router.post('/login', validate({ body: loginSchema }), loginHandler);
router.post('/refresh', validate({ body: refreshSchema }), refreshHandler);
router.get('/me', authenticate, meHandler);

export default router;
