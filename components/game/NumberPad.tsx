"use client";

import type { Digit } from "@/lib/sudoku/types";

type NumberPadProps = {
  onDigit: (digit: Digit) => void;
  disabled?: boolean;
  /** When true, that digit key is disabled (e.g. all nine already on the board). */
  digitSaturated?: (digit: Digit) => boolean;
};

const DIGITS: Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function NumberPad({ onDigit, disabled, digitSaturated }: NumberPadProps) {
  return (
    <div
      className="mx-auto grid w-full max-w-lg grid-cols-9 gap-1.5"
      aria-label="Number entry"
    >
      {DIGITS.map((d) => {
        const sat = digitSaturated?.(d) ?? false;
        const keyDisabled = disabled || sat;
        return (
          <button
            key={d}
            type="button"
            disabled={keyDisabled}
            onClick={() => onDigit(d)}
            className={[
              "min-h-11 min-w-0 rounded-lg border text-base font-semibold transition sm:min-h-11 sm:text-lg",
              sat
                ? "cursor-not-allowed border-foreground/10 bg-foreground/[0.03] text-foreground/35 opacity-60"
                : "border-foreground/20 bg-foreground/5 hover:bg-foreground/10 active:scale-[0.98]",
              disabled && !sat && "opacity-40",
            ].join(" ")}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}
