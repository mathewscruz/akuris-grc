import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { tGlobal } from '@/lib/i18n-global';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutos
const WARNING_TIMEOUT = 14 * 60 * 1000; // 14 minutos (1 min antes)
const THROTTLE_INTERVAL = 30 * 1000; // 30 segundos

export const useInactivityTimeout = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const warningTimeoutRef = useRef<NodeJS.Timeout>();
  const lastResetRef = useRef<number>(0);

  const logout = useCallback(async () => {
    await signOut();
    toast.error(tGlobal('cardsKpi.sweep.sistema.sessaoEncerrada'), {
      description: tGlobal('cardsKpi.sweep.sistema.sessaoEncerradaDesc'),
    });
    navigate('/auth');
  }, [signOut, navigate]);

  const showWarning = useCallback(() => {
    toast.warning(tGlobal('cardsKpi.sweep.sistema.sessaoExpirando'), {
      description: tGlobal('cardsKpi.sweep.sistema.sessaoExpirandoDesc'),
      duration: 60000,
    });
  }, []);

  const resetTimer = useCallback(() => {
    // Throttle: no máximo 1x a cada 30s
    const now = Date.now();
    if (now - lastResetRef.current < THROTTLE_INTERVAL) return;
    lastResetRef.current = now;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);

    warningTimeoutRef.current = setTimeout(showWarning, WARNING_TIMEOUT);
    timeoutRef.current = setTimeout(logout, INACTIVITY_TIMEOUT);
  }, [logout, showWarning]);

  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];

    events.forEach(event => {
      document.addEventListener(event, resetTimer, { passive: true });
    });

    resetTimer();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, [user, resetTimer]);
};
