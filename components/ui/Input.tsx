import { forwardRef, InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type InputProps =
  InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<
  HTMLInputElement,
  InputProps
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition",
        "placeholder:text-slate-400",
        "focus:border-blue-600",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";

export default Input;