import React, { useEffect, useState } from 'react';

interface CountUpProps {
  value: number;
  duration?: number; // duration in ms
  formatter?: (val: number) => string;
  className?: string;
  style?: React.CSSProperties;
}

export const CountUp: React.FC<CountUpProps> = ({
  value,
  duration = 800,
  formatter = (val) => val.toLocaleString('en-IN'),
  className = '',
  style
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = displayValue;
    const endValue = value;
    
    if (startValue === endValue) return;

    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function - easeOutQuad
      const easedProgress = progress * (2 - progress);
      const current = Math.floor(startValue + easedProgress * (endValue - startValue));
      
      setDisplayValue(current);
      
      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
      }
    };
    
    animationFrameId = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [value, duration]);

  return (
    <span className={`inline-block ${className}`} style={style}>
      {formatter(displayValue)}
    </span>
  );
};
