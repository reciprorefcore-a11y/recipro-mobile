import { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "danger" | "ghost";
};

const GRADIENT = "linear-gradient(135deg, #E85D2C 0%, #C04A1F 100%)";

export default function Button({
  variant = "primary",
  className = "",
  style,
  children,
  ...props
}: ButtonProps) {
  const base =
    "rounded-xl py-3 px-5 font-bold text-base transition-all " +
    "disabled:opacity-40 disabled:cursor-not-allowed " +
    "active:scale-[0.98] cursor-pointer";

  if (variant === "primary") {
    return (
      <button
        className={`${base} text-white shadow-md hover:shadow-lg ${className}`}
        style={{
          background: GRADIENT,
          boxShadow: "0 4px 12px rgba(232, 93, 44, 0.3)",
          minHeight: "56px",
          ...style,
        }}
        {...props}
      >
        {children}
      </button>
    );
  }

  if (variant === "outline") {
    return (
      <button
        className={`${base} bg-white text-primary border-2 border-primary hover:bg-primary-light ${className}`}
        style={{ minHeight: "52px", ...style }}
        {...props}
      >
        {children}
      </button>
    );
  }

  if (variant === "danger") {
    return (
      <button
        className={`${base} bg-danger text-white hover:opacity-90 ${className}`}
        style={{ minHeight: "52px", ...style }}
        {...props}
      >
        {children}
      </button>
    );
  }

  // ghost
  return (
    <button
      className={`${base} bg-transparent text-sub-text hover:bg-gray-100 ${className}`}
      style={{ minHeight: "44px", ...style }}
      {...props}
    >
      {children}
    </button>
  );
}
