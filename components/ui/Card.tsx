import { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export default function Card({ className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-sm p-4 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
