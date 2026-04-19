"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useConvexAuth } from "convex/react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { deriveKey, encrypt, decrypt } from "@/lib/crypto";

export interface StoredConfig {
  providerId: string;
  model: string;
  llmKey: string;
  sandboxKey: string;
}

const LS_KEY = "tryskills-config";

export function useKeyStore() {
  const { isAuthenticated } = useConvexAuth();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user } = useUser();
  const [config, setConfig] = useState<StoredConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrationPending, setMigrationPending] = useState(false);
  const loadedRef = useRef(false);

  const saveToConvex = useMutation(api.apiKeys.save);
  const removeFromConvex = useMutation(api.apiKeys.remove);
  const storedKeys = useQuery(
    api.apiKeys.load,
    isAuthenticated ? {} : "skip",
  );

  useEffect(() => {
    if (loadedRef.current) return;
    if (!authLoaded) return;

    // Not signed in -> done
    if (!isSignedIn) {
      loadedRef.current = true;
      setLoading(false);
      return;
    }

    // Signed in + Convex synced + query resolved
    if (isAuthenticated && user && storedKeys !== undefined) {
      loadedRef.current = true;

      if (storedKeys) {
        deriveKey(user.id)
          .then((key) => decrypt(storedKeys.encryptedData, storedKeys.iv, key))
          .then((plaintext) => {
            const parsed = JSON.parse(plaintext) as StoredConfig;
            setConfig(parsed);
            // Sync to localStorage as offline cache
            localStorage.setItem(LS_KEY, JSON.stringify(parsed));
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      } else {
        // No keys in Convex -- check localStorage for migration
        try {
          const raw = localStorage.getItem(LS_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as StoredConfig;
            if (parsed.llmKey || parsed.sandboxKey) {
              setConfig(parsed);
              setMigrationPending(true);
            }
          }
        } catch {}
        setLoading(false);
      }
      return;
    }

    // Signed in but Convex not yet synced -- use localStorage as cache while waiting
    // This avoids showing onboarding for users who have keys but Convex is slow
    if (isSignedIn && !isAuthenticated) {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as StoredConfig;
          if (parsed.llmKey && parsed.sandboxKey) {
            setConfig(parsed);
            loadedRef.current = true;
            setLoading(false);
            return;
          }
        }
      } catch {}
      // No cache -- keep waiting for Convex (spinner shows)
    }
  }, [authLoaded, isSignedIn, isAuthenticated, user, storedKeys]);

  const save = useCallback(
    async (newConfig: StoredConfig) => {
      setConfig(newConfig);
      // Always cache to localStorage as fallback
      localStorage.setItem(LS_KEY, JSON.stringify(newConfig));

      if (isAuthenticated && user) {
        const key = await deriveKey(user.id);
        const { ciphertext, iv } = await encrypt(JSON.stringify(newConfig), key);
        await saveToConvex({ encryptedData: ciphertext, iv });
        if (migrationPending) {
          setMigrationPending(false);
        }
      }
    },
    [isAuthenticated, user, saveToConvex, migrationPending],
  );

  const clear = useCallback(async () => {
    setConfig(null);
    localStorage.removeItem(LS_KEY);
    if (isAuthenticated) {
      await removeFromConvex({});
    }
  }, [isAuthenticated, removeFromConvex]);

  return { config, loading, isAuthenticated, migrationPending, save, clear };
}
