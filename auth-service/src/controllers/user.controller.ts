import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import type {
  ListUsersQuery,
  UpdateUserRoleInput,
  UserIdParam,
} from '../validations/user.validation';

export async function listUsersHandler(req: Request, res: Response): Promise<void> {
  const { users, pagination } = await userService.listUsers(req.query as unknown as ListUsersQuery);
  res.status(200).json({ success: true, data: { users, pagination } });
}

export async function updateUserRoleHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as UserIdParam;
  const { role } = req.body as UpdateUserRoleInput;
  const user = await userService.updateUserRole(req.user!.id, id, role);
  res.status(200).json({ success: true, message: 'User role updated', data: { user } });
}
