import React, { createContext, useContext, useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";

/* Lightweight shadcn-style primitives so the original MIMIRIA markup renders identically. */

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ---------------- Button ---------------- */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "lg" | "sm";
};
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0";
    const variants: Record<string, string> = {
      default: "bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)]",
      ghost: "hover:bg-[var(--bg-soft)]",
      outline: "border border-[var(--border)] bg-transparent hover:bg-[var(--bg-soft)]",
    };
    const sizes: Record<string, string> = {
      default: "h-10 px-4 py-2",
      lg: "h-11 px-6",
      sm: "h-8 px-3 text-xs",
    };
    return (
      <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props} />
    );
  }
);
Button.displayName = "Button";

/* ---------------- Input ---------------- */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] shadow-sm transition-colors file:border-0 file:bg-transparent placeholder:text-[var(--text-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/30 focus-visible:border-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

/* ---------------- Label ---------------- */
export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn("text-sm font-medium leading-none", className)} {...props} />
  )
);
Label.displayName = "Label";

/* ---------------- Badge ---------------- */
export const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-md border border-transparent px-2.5 py-0.5 text-xs font-semibold transition-colors w-fit",
        className
      )}
      {...props}
    />
  )
);
Badge.displayName = "Badge";

/* ---------------- Accordion ---------------- */
const AccordionCtx = createContext<{ value: string; setValue: (v: string) => void }>({
  value: "",
  setValue: () => {},
});

export function Accordion({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { type?: string; collapsible?: boolean; defaultValue?: string }) {
  const [value, setValue] = useState("");
  return (
    <AccordionCtx.Provider value={{ value, setValue }}>
      <div className={className} {...props}>
        {children}
      </div>
    </AccordionCtx.Provider>
  );
}

export function AccordionItem({
  children,
  className,
  value: itemValue,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const { value } = useContext(AccordionCtx);
  const open = value === itemValue;
  return (
    <div className={cn("border-b", className)} data-value={itemValue} data-state={open ? "open" : "closed"} {...props}>
      <ItemValueCtx.Provider value={itemValue}>{children}</ItemValueCtx.Provider>
    </div>
  );
}

const ItemValueCtx = createContext("");

export function AccordionTrigger({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { value, setValue } = useContext(AccordionCtx);
  const itemValue = useContext(ItemValueCtx);
  const open = value === itemValue;
  return (
    <h3 className="flex">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setValue(open ? "" : itemValue)}
        className={cn(
          "flex flex-1 cursor-pointer items-center justify-between gap-4 text-left text-sm font-medium transition-all hover:underline",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown
          size={17}
          className={cn(
            "shrink-0 text-[var(--text-3)] transition-transform duration-300",
            open && "rotate-180 text-[var(--brand-text)]"
          )}
        />
      </button>
    </h3>
  );
}

export function AccordionContent({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { value } = useContext(AccordionCtx);
  const itemValue = useContext(ItemValueCtx);
  const open = value === itemValue;
  return (
    <div
      data-state={open ? "open" : "closed"}
      className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-out",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      )}
      {...props}
    >
      <div className="overflow-hidden">
        <div className={cn("text-sm", className)}>{children}</div>
      </div>
    </div>
  );
}

/* ---------------- Dialog (modal) ---------------- */
export function Dialog({
  open,
  onOpenChange,
  children,
  panelClassName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  children: React.ReactNode;
  /** Permite ensanchar el panel (los textos legales necesitan más espacio). */
  panelClassName?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0F172A]/60 backdrop-blur-sm animate-overlay-in" onClick={() => onOpenChange(false)} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn("relative z-10 w-full sm:max-w-md bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] rounded-2xl shadow-[0_24px_64px_rgba(15,23,42,0.25)] p-6 sm:p-8 animate-modal-in max-h-[92vh] overflow-y-auto", panelClassName)}
      >
        <button
          onClick={() => onOpenChange(false)}
          aria-label="Cerrar"
          className="absolute right-4 top-4 p-1.5 rounded-full text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--bg-soft)] transition-colors"
        >
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}

export function DialogContent({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("", className)} {...props}>
      {children}
    </div>
  );
}

export function DialogHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}>{children}</div>;
}
export function DialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)}>{children}</h2>;
}
export function DialogDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-sm text-[var(--text-3)]", className)}>{children}</p>;
}
