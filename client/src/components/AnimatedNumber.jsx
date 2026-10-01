import React, { useEffect, useRef } from 'react';

export default function AnimatedNumber({ value }) {
  const nodeRef = useRef(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return undefined;

    const target = Number(value) || 0;
    const start = Number(node.dataset.value || 0);
    const duration = 500;
    const startAt = performance.now();
    let frame;

    function tick(now) {
      const progress = Math.min((now - startAt) / duration, 1);
      const current = Math.round(start + (target - start) * progress);
      node.textContent = String(current);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    node.dataset.value = String(target);
    frame = requestAnimationFrame(tick);

    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [value]);

  return <strong ref={nodeRef}>0</strong>;
}

