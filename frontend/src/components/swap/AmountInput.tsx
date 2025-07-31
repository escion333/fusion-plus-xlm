"use client";

import { Input } from "@/components/ui/input";

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function AmountInput({ 
  value, 
  onChange, 
  placeholder = "0.0",
  disabled = false 
}: AmountInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and decimal point
    if (/^\d*\.?\d*$/.test(value)) {
      onChange(value);
    }
  };

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      className="flex-1 bg-transparent text-2xl font-medium text-neutral-0 placeholder:text-neutral-500 focus:outline-none disabled:opacity-50 px-3 py-2"
    />
  );
}