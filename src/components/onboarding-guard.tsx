"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useKeyStore } from "@/hooks/use-key-store";
import { OnboardingModal } from "@/components/onboarding-modal";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const { config, loading } = useKeyStore();
  const [dismissed, setDismissed] = useState(false);

  // Don't show modal while auth or keys are loading
  if (!isLoaded || loading) return <>{children}</>;

  // Show modal if signed in, no saved keys, and not dismissed
  const needsOnboarding = isSignedIn && !config?.llmKey && !config?.sandboxKey && !dismissed;

  return (
    <>
      {children}
      {needsOnboarding && (
        <OnboardingModal onComplete={() => setDismissed(true)} />
      )}
    </>
  );
}
