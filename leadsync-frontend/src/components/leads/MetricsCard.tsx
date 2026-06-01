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
    <div className="bg-app-surface rounded-lg p-4 border border-app shadow-sm flex items-center justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-app-text-muted font-sans">{title}</p>
        <div className="text-2xl font-bold text-app-text font-sans">{value}</div>
        <p className="text-xs text-app-text-muted/60 font-sans">{description}</p>
      </div>
      <div className={`p-3 rounded-md ${iconBgColor || "bg-app-primary/10"}`}>
        <Icon size={20} className={iconColor || "text-app-primary"} />
      </div>
    </div>
  );
}
