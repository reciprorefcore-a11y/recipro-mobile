import { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline";
};

export default function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const base =
    "rounded-xl py-3 px-5 font-semibold text-base transition-opacity disabled:opacity-50 cursor-pointer";
  const variants = {
    primary: "bg-primary text-white",
    outline: "bg-white text-primary border-2 border-primary",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
