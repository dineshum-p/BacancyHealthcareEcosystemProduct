import { cn } from "@/lib/utils";

export interface WordmarkProps {
  size?: "sm" | "lg";
  className?: string;
}

/** The one recurring brand mark used on both the login card and the console sidebar. */
export function Wordmark({ size = "lg", className }: WordmarkProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground",
          size === "lg" ? "size-9 text-base" : "size-7 text-sm",
        )}
        aria-hidden
      >
        H
      </span>
      <div className="flex flex-col leading-tight">
        <span
          className={cn(
            "font-heading font-semibold text-foreground",
            size === "lg" ? "text-lg" : "text-sm",
          )}
        >
          HEP
        </span>
        {size === "lg" && (
          <span className="text-xs text-muted-foreground">
            Healthcare Ecosystem Platform
          </span>
        )}
      </div>
    </div>
  );
}
