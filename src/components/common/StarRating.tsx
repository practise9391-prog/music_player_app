import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number; // 0 to 5
  onChange?: (newRating: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readonly?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  onChange,
  size = 'md',
  readonly = false,
}) => {
  const currentRating = Math.max(0, Math.min(5, Math.round(rating || 0)));

  const sizeClass =
    size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5';

  const handleClick = (e: React.MouseEvent, starVal: number) => {
    e.stopPropagation();
    if (readonly || !onChange) return;
    // Clicking the current rating resets it to 0
    if (currentRating === starVal) {
      onChange(0);
    } else {
      onChange(starVal);
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-0.5 select-none ${
        readonly ? 'cursor-default' : 'cursor-pointer'
      }`}
      title={currentRating > 0 ? `Rating: ${currentRating}/5 stars` : 'Not rated'}
    >
      {[1, 2, 3, 4, 5].map((starIndex) => {
        const isFilled = starIndex <= currentRating;
        return (
          <button
            key={starIndex}
            type="button"
            disabled={readonly}
            onClick={(e) => handleClick(e, starIndex)}
            className={`p-0.5 rounded transition-transform ${
              readonly
                ? ''
                : 'hover:scale-125 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]'
            }`}
          >
            <Star
              className={`${sizeClass} transition-colors ${
                isFilled
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-[var(--text-muted)] hover:text-amber-300'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
};
