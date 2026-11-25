import { useEffect, useState } from 'react';

export function useCountdown(initialSeconds = 0) {
  const [secondsLeft, setSecondsLeft] = useState(Math.max(0, Math.floor(initialSeconds)));

  useEffect(() => {
    setSecondsLeft(Math.max(0, Math.floor(initialSeconds)));
  }, [initialSeconds]);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft > 0]);

  return [secondsLeft, setSecondsLeft];
}
