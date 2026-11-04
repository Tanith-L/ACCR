import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** The system's "reduce motion" setting. Every animation in the app checks this. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let current = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => current && setReduced(value));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      current = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}
