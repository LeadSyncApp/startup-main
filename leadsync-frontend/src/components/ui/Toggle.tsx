import React from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, disabled = false }) => {
  return (
    <label className={`flex items-center justify-between gap-4 py-3 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
      <span className="text-sm font-medium" style={{ color: "var(--app-text)" }}>
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2"
        style={{
          backgroundColor: checked ? "var(--brand-saffron)" : "var(--app-border)"
        }}
      >
        <span
          className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out"
          style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
        />
      </button>
    </label>
  );
};
