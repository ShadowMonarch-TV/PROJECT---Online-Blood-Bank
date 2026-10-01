import React from 'react';
import AnimatedNumber from './AnimatedNumber.jsx';

export default function StatGrid({ items }) {
  if (!items || items.length === 0) {
    return <div className="stats"></div>;
  }

  return (
    <div className="stats">
      {items.map(([label, value]) => (
        <div className="stat-card" key={label}>
          <span>{label}</span>
          <AnimatedNumber value={value} />
        </div>
      ))}
    </div>
  );
}

