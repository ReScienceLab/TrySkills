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

function lsKey(userId: string): string {
  return `tryskills-config-${userId}`;
}

const CONVEX_SYNC_TIMEOUT_MS = 10_000;

export function useKeyStore() {
  const { isAuthenticated } = useConvexAuth();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user } = useUser();
  const [config, setConfig] = useState<StoredConfig | null>(null);
  const [loading, setLoading] = useState(true);
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

    if (!isSignedIn) {
      loadedRef.current = true;
      setLoading(false);
      return;
    }

    // Convex synced + query resolved -> authoritative source
    if (isAuthenticated && user && storedKeys !== undefined) {
      loadedRef.current = true;
      if (storedKeys) {
        deriveKey(user.id)
          .then((key) => decrypt(storedKeys.encryptedData, storedKeys.iv, key))
          .then((plaintext) => {
            const parsed = JSON.parse(plaintext) as StoredConfig;
            setConfig(parsed);
            localStorage.setItem(lsKey(user.id), JSON.stringify(parsed));
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
      return;
    }

    // Convex not synced yet -- use per-user cache while waiting
    if (isSignedIn && user && !isAuthenticated) {
      try {
        const raw = localStorage.getItem(lsKey(user.id));
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
    }
  }, [authLoaded, isSignedIn, isAuthenticated, user, storedKeys]);

  // Timeout fallback: stop loading if Convex never syncs
  useEffect(() => {
    if (!authLoaded || !isSignedIn || loadedRef.current) return;
    const timer = setTimeout(() => {
      if (!loadedRef.current) {
        loadedRef.current = true;
        setLoading(false);
      }
    }, CONVEX_SYNC_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [authLoaded, isSignedIn]);

  const save = useCallback(
    async (newConfig: StoredConfig) => {
      setConfig(newConfig);
      if (user) {
        localStorage.setItem(lsKey(user.id), JSON.stringify(newConfig));
      }
      if (isAuthenticated && user) {
        const key = await deriveKey(user.id);
        const { ciphertext, iv } = await encrypt(JSON.stringify(newConfig), key);
        await saveToConvex({ encryptedData: ciphertext, iv });
      }
    },
    [isAuthenticated, user, saveToConvex],
  );

  const clear = useCallback(async () => {
    setConfig(null);
    if (user) {
      localStorage.removeItem(lsKey(user.id));
    }
    if (isAuthenticated) {
      await removeFromConvex({});
    }
  }, [isAuthenticated, user, removeFromConvex]);

  return { config, loading, save, clear };
}
