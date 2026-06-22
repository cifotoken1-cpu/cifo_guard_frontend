import { useEffect, useState } from 'react';

function toWIB() {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 7 * 3600000);
}

/** Returns a Date in WIB (UTC+7) that re-renders every second. */
export function useClock() {
  const [now, setNow] = useState(toWIB);
  useEffect(() => {
    const t = setInterval(() => setNow(toWIB()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}
