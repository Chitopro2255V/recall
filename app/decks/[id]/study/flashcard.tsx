"use client";

export function Flashcard({
  front,
  back,
  flipped,
  onFlip,
}: {
  front: string;
  back: string;
  flipped: boolean;
  onFlip: () => void;
}) {
  return (
    <div
      className="w-full cursor-pointer select-none"
      onClick={onFlip}
      role="button"
      tabIndex={0}
      aria-label={flipped ? "Show question" : "Show answer"}
    >
      <div className="relative h-[320px] [perspective:1200px] sm:h-[380px]">
        <div
          className="absolute inset-0 transition-transform duration-500 [transform-style:preserve-3d]"
          style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          {/* Front — the question */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl border bg-card p-6 text-center shadow-sm [backface-visibility:hidden]">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Question
            </span>
            <p className="max-w-xl text-lg font-medium text-foreground sm:text-xl">{front}</p>
            <span className="text-xs text-muted-foreground">tap to reveal</span>
          </div>

          {/* Back — the answer (pre-rotated so it lands face-up) */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl border bg-muted/50 p-6 text-center shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Answer
            </span>
            <p className="max-w-xl text-base text-foreground sm:text-lg">{back}</p>
            <span className="text-xs text-muted-foreground">tap to flip back</span>
          </div>
        </div>
      </div>
    </div>
  );
}