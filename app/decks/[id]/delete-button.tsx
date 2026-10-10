"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteDeck } from "./actions";

export function DeleteDeckButton({ deckId, deckTitle }: { deckId: string; deckTitle: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (confirm(`Delete "${deckTitle}" and all its cards? This cannot be undone.`)) {
          startTransition(async () => {
            await deleteDeck(deckId);
          });
        }
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}