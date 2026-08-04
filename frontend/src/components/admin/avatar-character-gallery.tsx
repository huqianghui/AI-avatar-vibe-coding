import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { AVATAR_CHARACTERS, getAvatarInitials } from "@/data/avatar-characters";
import { CDN_BASE } from "@/lib/voice-constants";
import { cn } from "@/lib/utils";

type AvatarGridItem = {
  characterId: string;
  displayName: string;
  style: string;
  styleLabel: string;
  isPhotoAvatar: boolean;
  thumbnailUrl: string;
  gradientClasses: string;
};

interface AvatarCharacterGalleryProps {
  character: string;
  style: string;
  onSelect: (characterId: string, style: string) => void;
  className?: string;
}

/**
 * Shared, filterable (all/photo/video) avatar character+style picker with
 * thumbnail-fallback-to-initials. Reusable by both the HCP profile editor
 * and the persona editor (Plan 38-03).
 *
 * Owns its own filter state, item derivation, and failed-thumbnail tracking
 * so callers can drop it in with just `character`/`style`/`onSelect`.
 */
export function AvatarCharacterGallery({
  character,
  style,
  onSelect,
  className,
}: AvatarCharacterGalleryProps) {
  const { t } = useTranslation("admin");
  const [avatarFilter, setAvatarFilter] = useState<"all" | "photo" | "video">("all");

  const failedThumbnailsRef = useRef(new Set<string>());
  const [, setThumbnailRerender] = useState(0);
  const handleThumbnailError = useCallback((key: string) => {
    if (!failedThumbnailsRef.current.has(key)) {
      failedThumbnailsRef.current.add(key);
      setThumbnailRerender((n) => n + 1);
    }
  }, []);

  const filteredAvatarItems = useMemo(() => {
    const items: AvatarGridItem[] = [];
    for (const c of AVATAR_CHARACTERS) {
      if (c.isPhotoAvatar) {
        if (avatarFilter === "video") continue;
        items.push({
          characterId: c.id,
          displayName: c.displayName,
          style: "",
          styleLabel: "",
          isPhotoAvatar: true,
          thumbnailUrl: c.thumbnailUrl,
          gradientClasses: c.gradientClasses,
        });
      } else {
        if (avatarFilter === "photo") continue;
        for (const s of c.styles) {
          items.push({
            characterId: c.id,
            displayName: c.displayName,
            style: s,
            styleLabel: s.replace(/-/g, " "),
            isPhotoAvatar: false,
            thumbnailUrl: `${CDN_BASE}/${c.id}-${s}.png`,
            gradientClasses: c.gradientClasses,
          });
        }
      }
    }
    return items;
  }, [avatarFilter]);

  return (
    <div className={className}>
      <div className="flex gap-1">
        {(["all", "photo", "video"] as const).map((filter) => (
          <Button
            key={filter}
            type="button"
            size="sm"
            variant={avatarFilter === filter ? "default" : "outline"}
            className="h-6 text-[10px] px-2"
            onClick={() => setAvatarFilter(filter)}
          >
            {t(
              `voiceLive.vlDialogFilter${filter.charAt(0).toUpperCase() + filter.slice(1)}` as `voiceLive.vlDialogFilter${"All" | "Photo" | "Video"}`,
            )}
          </Button>
        ))}
      </div>

      <div
        data-testid="avatar-character-grid"
        className="grid grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1 mt-2"
      >
        {filteredAvatarItems.map((item) => {
          const gridKey = item.isPhotoAvatar
            ? item.characterId
            : `${item.characterId}-${item.style}`;
          const isSelected =
            character === item.characterId && (item.isPhotoAvatar || style === item.style);
          const imgFailed = failedThumbnailsRef.current.has(gridKey);

          return (
            <button
              key={gridKey}
              type="button"
              data-testid={`avatar-item-${gridKey}`}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-all hover:bg-accent/50 cursor-pointer",
                isSelected && "ring-2 ring-primary border-primary",
              )}
              onClick={() => onSelect(item.characterId, item.style)}
            >
              {!imgFailed ? (
                <div className="w-full aspect-[3/4] overflow-hidden rounded-md bg-muted/30">
                  <img
                    src={item.thumbnailUrl}
                    alt={item.displayName}
                    className="size-full object-contain"
                    onError={() => handleThumbnailError(gridKey)}
                  />
                </div>
              ) : (
                <div
                  className={cn(
                    "w-full aspect-[3/4] rounded-md flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br",
                    item.gradientClasses,
                  )}
                >
                  {getAvatarInitials(item.displayName)}
                </div>
              )}
              <span className="text-[9px] leading-tight text-center truncate w-full">
                {item.displayName}
                {item.styleLabel ? ` (${item.styleLabel})` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
