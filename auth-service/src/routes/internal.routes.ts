import { Router } from 'express';
import { getUserInternalHandler } from '../controllers/internal.controller';
import { internalOnly } from '../middlewares/internalOnly';
import { validate } from '../middlewares/validate';
import { userIdParamSchema } from '../validations/user.validation';

const router = Router();

router.use(internalOnly);

router.get('/users/:id', validate({ params: userIdParamSchema }), getUserInternalHandler);

export default router;
