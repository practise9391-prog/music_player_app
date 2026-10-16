import React, { useState, useRef, useCallback } from 'react';

interface VerticalAlphabetNavigatorProps {
  selectedLetter: string;
  onSelectLetter: (letter: string) => void;
  availableLetters?: Set<string>;
}

const LETTERS = [
  'All',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  '#',
];

export const VerticalAlphabetNavigator: React.FC<VerticalAlphabetNavigatorProps> = ({
  selectedLetter,
  onSelectLetter,
  availableLetters,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [activeDragLetter, setActiveDragLetter] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const calculateLetterFromY = useCallback((clientY: number): string | null => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    const percentage = Math.max(0, Math.min(1, relativeY / rect.height));
    const index = Math.floor(percentage * LETTERS.length);
    const clampedIndex = Math.max(0, Math.min(LETTERS.length - 1, index));
    return LETTERS[clampedIndex];
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    const letter = calculateLetterFromY(e.clientY);
    if (letter) {
      setActiveDragLetter(letter);
      onSelectLetter(letter);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const letter = calculateLetterFromY(e.clientY);
    if (letter && letter !== activeDragLetter) {
      setActiveDragLetter(letter);
      onSelectLetter(letter);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      setIsDragging(false);
      setActiveDragLetter(null);
    }
  };

  return (
    <div className="relative select-none touch-none">
      {/* Floating Enlarged Letter Preview Bubble */}
      {isDragging && activeDragLetter && (
        <div
          className="fixed right-14 sm:right-16 top-1/2 -translate-y-1/2 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-purple-600 via-purple-500 to-pink-500 text-white font-black text-2xl sm:text-3xl flex items-center justify-center shadow-2xl shadow-purple-900/60 border border-white/20 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-100"
          style={{ transform: 'translateY(-50%)' }}
        >
          {activeDragLetter}
        </div>
      )}

      {/* Vertical Alphabet Bar */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="flex flex-col justify-between items-center py-1.5 px-1 rounded-full bg-[var(--surface-secondary)]/90 backdrop-blur-md border border-purple-500/20 shadow-xl cursor-pointer w-6 sm:w-7 h-[calc(100vh-14rem)] min-h-[360px] max-h-[560px]"
        aria-label="Alphabetical jump navigator"
      >
        {LETTERS.map((char) => {
          const isSelected = selectedLetter === char || (isDragging && activeDragLetter === char);
          const hasSongs = !availableLetters || char === 'All' || availableLetters.has(char);

          return (
            <button
              key={char}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectLetter(char);
              }}
              className={`w-full flex items-center justify-center rounded-full transition-all text-[8px] sm:text-[9px] font-bold leading-none py-0.5 ${
                isSelected
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md scale-125 z-10'
                  : hasSongs
                  ? 'text-[var(--text-secondary)] hover:text-white hover:scale-110'
                  : 'text-[var(--text-muted)]/40 hover:text-[var(--text-muted)]'
              }`}
            >
              {char === 'All' ? '•' : char}
            </button>
          );
        })}
      </div>
    </div>
  );
};

