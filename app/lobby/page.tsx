import { Suspense } from "react";
import { LobbyView } from "@/components/lobby/LobbyView";

export default function LobbyPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-24 text-center text-sm text-foreground/60">
          Loading lobby…
        </div>
      }
    >
      <LobbyView />
    </Suspense>
  );
}
