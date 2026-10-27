import type { HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  rounded?: "sm" | "md" | "lg" | "full";
  className?: string;
}

export function Skeleton({
  width,
  height,
  rounded = "md",
  className = "",
  style,
  ...props
}: SkeletonProps) {
  const roundedClass =
    rounded === "sm"
      ? "rounded-sm"
      : rounded === "lg"
        ? "rounded-lg"
        : rounded === "full"
          ? "rounded-full"
          : "rounded";

  return (
    <div
      className={`skeleton-shimmer ${roundedClass} ${className}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="skeleton-table-wrapper" aria-hidden="true">
      <div className="skeleton-table-header">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`th-${i}`} height={16} width={i === 0 ? "40%" : "60%"} />
        ))}
      </div>
      <div className="skeleton-table-body">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`tr-${r}`} className="skeleton-table-row">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={`td-${r}-${c}`} height={14} width={c === 0 ? "70%" : "50%"} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
