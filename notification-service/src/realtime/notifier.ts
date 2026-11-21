import { doctorRoom, getIO, userRoom } from './socketServer';

// No-op when the socket server has not been started (e.g. in unit tests that
// call the service layer directly): emitting is always best-effort and must
// never be the reason a request or event fails.
export function emitToUser(userId: string, event: string, payload: unknown): void {
  getIO()?.to(userRoom(userId)).emit(event, payload);
}

export function emitToDoctorWatchers(doctorId: string, event: string, payload: unknown): void {
  getIO()?.to(doctorRoom(doctorId)).emit(event, payload);
}
