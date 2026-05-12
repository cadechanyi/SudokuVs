import { Suspense } from "react";
import { GamePageClient } from "@/components/game/GamePageClient";

export default function SingleGamePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-24 text-center text-sm text-foreground/60">
          Loading game…
        </div>
      }
    >
      <GamePageClient />
    </Suspense>
  );
}
