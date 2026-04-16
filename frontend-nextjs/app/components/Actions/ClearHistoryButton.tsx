"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export default function ClearHistoryButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [isClearing, setIsClearing] = useState(false);

  const handleClearHistory = async () => {
    const confirmed = window.confirm(
      "Clear all action and conversation history for this patient?",
    );

    if (!confirmed) {
      return;
    }

    setIsClearing(true);

    try {
      const response = await fetch("/api/actions/clear", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to clear action history");
      }

      toast({
        description: "History cleared.",
      });
      router.refresh();
    } catch (error) {
      console.error("Failed to clear action history", error);
      toast({
        description: "Failed to clear history.",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="destructive_outline"
      className="flex items-center gap-2"
      onClick={handleClearHistory}
      disabled={isClearing}
    >
      {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      Clear History
    </Button>
  );
}
