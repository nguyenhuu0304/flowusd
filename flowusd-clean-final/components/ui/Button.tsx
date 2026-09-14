import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant =
  | "default"
  | "primary"
  | "secondary"
  | "outline"
  | "danger";

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
}

export default function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const variants: Record<ButtonVariant, string> = {
    default:
      "bg-blue-600 text-white hover:bg-blue-700",

    primary:
      "bg-blue-600 text-white hover:bg-blue-700",

    secondary:
      "bg-slate-900 text-white hover:bg-slate-800",

    outline:
      "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",

    danger:
      "bg-red-600 text-white hover:bg-red-700",
  };

  return (
    <button
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
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