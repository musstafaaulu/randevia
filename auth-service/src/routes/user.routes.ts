import { Router } from 'express';
import {
  getUserStatsHandler,
  listUsersHandler,
  updateUserRoleHandler,
} from '../controllers/user.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import {
  listUsersQuerySchema,
  updateUserRoleSchema,
  userIdParamSchema,
} from '../validations/user.validation';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/', validate({ query: listUsersQuerySchema }), listUsersHandler);
router.get('/stats', getUserStatsHandler);
router.patch(
  '/:id/role',
  validate({ params: userIdParamSchema, body: updateUserRoleSchema }),
  updateUserRoleHandler,
);

export default router;
