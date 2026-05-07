interface Props {
  className?: string;
}

export function Skeleton({ className = "h-4 w-24" }: Props) {
  return <span className={`block skeleton ${className}`} aria-hidden="true" />;
}

export function MessageSkeleton({ side = "left" }: { side?: "left" | "right" }) {
  return (
    <div className={`flex ${side === "right" ? "justify-end" : "justify-start"} animate-fade-in`}>
      <div className="max-w-[68%] space-y-2">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-4 w-28" />
      </div>
    </div>
  );
}
