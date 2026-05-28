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
  iconBgColor = "bg-app-primary/10",
  iconColor = "text-app-primary",
}: MetricsCardProps) {
  return (
    <div className="bg-app-surface rounded-lg p-4 border border-app-border shadow-sm flex items-center justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-app-muted font-sans">{title}</p>
        <div className="text-2xl font-bold text-app-text font-sans">{value}</div>
        <p className="text-xs text-slate-400 font-sans">{description}</p>
      </div>
      <div className={`p-3 rounded-md ${iconBgColor}`}>
        <Icon size={20} className={iconColor} />
      </div>
    </div>
  );
}
