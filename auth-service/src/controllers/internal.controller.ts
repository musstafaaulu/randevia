import { Request, Response } from 'express';
import { User } from '../models/User.model';
import { ApiError } from '../utils/ApiError';

export async function getUserInternalHandler(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new ApiError(404, 'Kullanıcı bulunamadı');
  }
  res.status(200).json({
    success: true,
    data: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
  });
}
