
import React from 'react';
import { Severity } from '../types';

interface GaugeProps {
  severity: Severity;
}

const severityConfig = {
  [Severity.HEALTHY]: { percentage: 0, color: 'text-green-400', glow: 'shadow-[0_0_15px_#48bb78]', label: 'Healthy' },
  [Severity.MILD]: { percentage: 33, color: 'text-yellow-400', glow: 'shadow-[0_0_15px_#f6e05e]', label: 'Mild' },
  [Severity.MODERATE]: { percentage: 66, color: 'text-orange-400', glow: 'shadow-[0_0_15px_#ed8936]', label: 'Moderate' },
  [Severity.SEVERE]: { percentage: 100, color: 'text-red-500', glow: 'shadow-[0_0_15px_#f56565]', label: 'Severe' },
};

const Gauge: React.FC<GaugeProps> = ({ severity }) => {
  const config = severityConfig[severity] || severityConfig[Severity.HEALTHY];
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (config.percentage / 100) * circumference;

  return (
    <div className="relative w-40 h-40 flex items-center justify-center">
      <svg className="absolute w-full h-full" viewBox="0 0 100 100">
        <circle
          className="text-gray-700/50"
          strokeWidth="5"
          stroke="currentColor"
          fill="transparent"
          r="45"
          cx="50"
          cy="50"
        />
        <circle
          className={`${config.color} transition-all duration-1000 ease-in-out`}
          strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r="45"
          cx="50"
          cy="50"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className={`text-center ${config.color} ${config.glow} rounded-full`}>
        <div className="text-3xl font-bold">{config.percentage}%</div>
        <div className="text-sm tracking-wider">{config.label}</div>
      </div>
    </div>
  );
};

export default Gauge;
