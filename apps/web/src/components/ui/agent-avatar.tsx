import { cn } from "@/lib/utils";
import type { CrewMember } from "@/lib/crew";

interface AgentAvatarProps {
  agent: CrewMember;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  showTitle?: boolean;
}

export function AgentAvatar({
  agent,
  size = "sm",
  showName = true,
  showTitle = false,
}: AgentAvatarProps) {
  const Icon = agent.icon;
  const sizeClasses = {
    sm: "h-5 w-5",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };
  const iconSizes = { sm: 12, md: 16, lg: 24 };

  return (
    <div className="inline-flex items-center gap-1.5">
      <div
        className={cn(
          "flex flex-shrink-0 items-center justify-center rounded-full",
          agent.bgColor,
          sizeClasses[size]
        )}
      >
        <Icon size={iconSizes[size]} className={agent.color} />
      </div>
      {(showName || showTitle) && (
        <div className="flex items-center gap-1">
          {showName && (
            <span className={cn("text-2xs font-medium", agent.color)}>
              {agent.name}
            </span>
          )}
          {showTitle && (
            <span className="text-2xs text-text-tertiary">
              {agent.title}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
