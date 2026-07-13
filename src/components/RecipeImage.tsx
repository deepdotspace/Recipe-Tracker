import { useState } from 'react'
import { ChefHat } from 'lucide-react'

interface RecipeImageProps {
  src?: string
  alt?: string
  /** ChefHat fallback icon size in px (default 44). */
  iconSize?: number
}

/**
 * Recipe photo with a graceful fallback. Recipe image URLs are third-party
 * (Instagram CDN, recipe blogs like recipetineats.com) and frequently 403 on
 * a cross-origin hotlink or expire outright. `referrerPolicy="no-referrer"`
 * recovers hosts that gate on the Referer header; `onError` swaps in the
 * ChefHat placeholder so a dead URL renders as the empty tile rather than a
 * broken-image glyph.
 *
 * Fills its parent — the parent owns sizing, rounding, and the bg-photo-tile.
 */
export function RecipeImage({ src, alt = '', iconSize = 44 }: RecipeImageProps) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center text-[#c9b299]">
        <ChefHat size={iconSize} strokeWidth={1.4} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover"
    />
  )
}
