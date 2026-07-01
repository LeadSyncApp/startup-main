import React from 'react';
import { motion } from 'framer-motion';

interface DailyPulseAdaptiveWidgetProps {
  children: React.ReactNode;
  dailyRevenueTarget: string | number;
}

export const DailyPulseAdaptiveWidget: React.FC<DailyPulseAdaptiveWidgetProps> = ({
  children,
  dailyRevenueTarget
}) => {
  const progressVal = 4200; // static completed value matching existing dashboard metrics
  const targetVal = typeof dailyRevenueTarget === 'string' ? parseFloat(dailyRevenueTarget) || 5000 : dailyRevenueTarget || 5000;
  const percentage = Math.min(100, Math.round((progressVal / targetVal) * 100));

  // Radial Progress parameters
  const radius = 64;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div id="daily-pulse-adaptive-root" className="w-full">
      {/* Desktop: Render the beautiful rich hourly sales bar metrics */}
      <div className="hidden md:block w-full">
        {children}
      </div>

      {/* Mobile/Android: Clean high-contrast Radial Progress Ring */}
      <div className="block md:hidden bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center shadow-xs animate-fade-in">
        <div className="relative flex items-center justify-center mx-auto" style={{ width: radius * 2, height: radius * 2 }}>
          <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
            {/* Background trail ring */}
            <circle
              stroke="#e2e8f0"
              fill="transparent"
              strokeWidth={stroke}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
            {/* High-Contrast responsive teal/emerald ring */}
            <motion.circle
              stroke="#0d9488"
              fill="transparent"
              strokeWidth={stroke}
              strokeDasharray={circumference + ' ' + circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
              strokeLinecap="round"
            />
          </svg>
          
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-xl font-black text-slate-900 font-mono tracking-tight">{percentage}%</span>
            <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest leading-none">TARGET</span>
          </div>
        </div>

        <div className="mt-4 space-y-1">
          <p className="text-sm font-black text-slate-800">₹{progressVal.toLocaleString("en-IN")} Achieved</p>
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Daily Goal: ₹{targetVal.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
