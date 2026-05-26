import React from "react";

export interface MetricsCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  iconBgColor?: string;
  iconColor?: string;
}

export default function MetricsCard({
  title,
  value,
  description,
  icon: Icon,
  iconBgColor = "bg-blue-50",
  iconColor = "text-blue-600",
}: MetricsCardProps) {
  return (
    <div className="bg-white rounded-lg p-4 border border-[#E2E8F0] shadow-sm flex items-center justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-500 font-sans">{title}</p>
        <div className="text-2xl font-bold text-slate-900 font-sans">{value}</div>
        <p className="text-xs text-slate-400 font-sans">{description}</p>
      </div>
      <div className={`p-3 rounded-md ${iconBgColor}`}>
        <Icon size={20} className={iconColor} />
      </div>
    </div>
  );
}
