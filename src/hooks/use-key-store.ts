"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useConvexAuth } from "convex/react";
import { useUser } from "@clerk/nextjs";
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
  const { user } = useUser();
  const [config, setConfig] = useState<StoredConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrationPending, setMigrationPending] = useState(false);
  const initialLoadDone = useRef(false);

  const saveToConvex = useMutation(api.apiKeys.save);
  const removeFromConvex = useMutation(api.apiKeys.remove);
  const storedKeys = useQuery(
    api.apiKeys.load,
    isAuthenticated ? {} : "skip",
  );

  // Load keys from Convex when authenticated
  useEffect(() => {
    if (!isAuthenticated || !user || initialLoadDone.current) return;
    if (storedKeys === undefined) return; // still loading

    const loadFromConvex = async () => {
      try {
        if (storedKeys) {
          const key = await deriveKey(user.id);
          const plaintext = await decrypt(
            storedKeys.encryptedData,
            storedKeys.iv,
            key,
          );
          setConfig(JSON.parse(plaintext) as StoredConfig);
        } else {
          // Check for localStorage migration
          const raw = localStorage.getItem("tryskills-config");
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as StoredConfig;
              if (parsed.llmKey || parsed.sandboxKey) {
                setConfig(parsed);
                setMigrationPending(true);
              }
            } catch {
              // corrupted localStorage, ignore
            }
          }
        }
      } catch {
        // decryption failed, ignore
      } finally {
        initialLoadDone.current = true;
        setLoading(false);
      }
    };

    void loadFromConvex();
  }, [isAuthenticated, user, storedKeys]);

  // For unauthenticated users, mark loading as done immediately
  useEffect(() => {
    if (!isAuthenticated && !initialLoadDone.current) {
      initialLoadDone.current = true;
      setLoading(false);
    }
  }, [isAuthenticated]);

  const save = useCallback(
    async (newConfig: StoredConfig) => {
      setConfig(newConfig);

      if (isAuthenticated && user) {
        const key = await deriveKey(user.id);
        const { ciphertext, iv } = await encrypt(
          JSON.stringify(newConfig),
          key,
        );
        await saveToConvex({ encryptedData: ciphertext, iv });

        // Clear localStorage after successful migration
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

  return {
    config,
    loading,
    isAuthenticated,
    migrationPending,
    save,
    clear,
  };
}
