import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "danger";
}

export default function Button({
  children,
  variant = "primary",
  className,
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      "bg-blue-600 text-white hover:bg-blue-700",

    secondary:
      "bg-slate-900 text-white hover:bg-slate-800",

    outline:
      "border border-slate-300 bg-white hover:bg-slate-50",

    danger:
      "bg-red-600 text-white hover:bg-red-700",
  };

  return (
    <button
      className={[
        "rounded-xl px-6 py-3 font-semibold transition",
        variants[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}