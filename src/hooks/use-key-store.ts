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

    // Wait for Clerk to load
    if (!authLoaded) return;

    // Not signed in -> done
    if (!isSignedIn) {
      loadedRef.current = true;
      setLoading(false);
      return;
    }

    // Signed in, wait for Convex auth to sync
    if (!isAuthenticated || !user) return;

    // Convex query still loading
    if (storedKeys === undefined) return;

    // Now we have the result
    loadedRef.current = true;

    if (storedKeys) {
      deriveKey(user.id)
        .then((key) => decrypt(storedKeys.encryptedData, storedKeys.iv, key))
        .then((plaintext) => setConfig(JSON.parse(plaintext) as StoredConfig))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      // Check localStorage for migration
      try {
        const raw = localStorage.getItem("tryskills-config");
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
  }, [authLoaded, isSignedIn, isAuthenticated, user, storedKeys]);

  // Fallback: if signed in but Convex never syncs (e.g. stale session), stop loading after 5s
  useEffect(() => {
    if (!authLoaded || !isSignedIn || loadedRef.current) return;
    const timer = setTimeout(() => {
      if (!loadedRef.current) {
        loadedRef.current = true;
        setLoading(false);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [authLoaded, isSignedIn]);

  const save = useCallback(
    async (newConfig: StoredConfig) => {
      setConfig(newConfig);
      if (isAuthenticated && user) {
        const key = await deriveKey(user.id);
        const { ciphertext, iv } = await encrypt(JSON.stringify(newConfig), key);
        await saveToConvex({ encryptedData: ciphertext, iv });
        if (migrationPending) {
          localStorage.removeItem("tryskills-config");
          setMigrationPending(false);
        }
      }
    },
    [isAuthenticated, user, saveToConvex, migrationPending],
  );

  const clear = useCallback(async () => {
    setConfig(null);
    if (isAuthenticated) {
      await removeFromConvex({});
    }
    localStorage.removeItem("tryskills-config");
  }, [isAuthenticated, removeFromConvex]);

  return { config, loading, isAuthenticated, migrationPending, save, clear };
}
