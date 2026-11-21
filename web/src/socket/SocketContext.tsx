import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '../auth/AuthContext';
import { getAccessToken } from '../api/client';
import { API_BASE_URL } from '../config';

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  // By the time `user` goes from null to set (login, register, or the
  // silent-refresh bootstrap on reload), AuthContext has already updated the
  // access token, so it is safe to read here synchronously.
  useEffect(() => {
    const token = getAccessToken();
    if (!user || !token) {
      setSocket(null);
      return;
    }

    const next = io(API_BASE_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token },
    });
    setSocket(next);

    return () => {
      next.disconnect();
    };
  }, [user]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket(): Socket | null {
  return useContext(SocketContext);
}
