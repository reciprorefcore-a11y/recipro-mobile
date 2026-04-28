import { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export default function Input({ label, className = "", ...props }: InputProps) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium mb-1">{label}</label>
      )}
      <input
        className={`w-full rounded-xl border border-gray-200 px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-primary ${className}`}
        {...props}
      />
    </div>
  );
}
