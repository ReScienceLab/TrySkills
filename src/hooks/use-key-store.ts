"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
  providerKeys?: Record<string, string>;
}

function lsKey(userId: string): string {
  return `tryskills-config-${userId}`;
}

function migrateConfig(raw: StoredConfig): StoredConfig {
  if (!raw.providerKeys) {
    const providerKeys: Record<string, string> = {};
    if (raw.providerId && raw.llmKey) {
      providerKeys[raw.providerId] = raw.llmKey;
    }
    return { ...raw, providerKeys };
  }
  return raw;
}

function readLocalCache(userId: string): StoredConfig | null {
  try {
    const raw = localStorage.getItem(lsKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConfig;
    if (parsed.providerKeys) {
      const activeKey = parsed.providerKeys[parsed.providerId] ?? "";
      if (activeKey && parsed.sandboxKey) return { ...parsed, llmKey: activeKey };
    }
    if (parsed.llmKey && parsed.sandboxKey) return migrateConfig(parsed);
    return null;
  } catch {
    return null;
  }
}

export function useKeyStore() {
  const { isAuthenticated } = useConvexAuth();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user } = useUser();

  const saveToConvex = useMutation(api.apiKeys.save);
  const removeFromConvex = useMutation(api.apiKeys.remove);
  const storedKeys = useQuery(
    api.apiKeys.load,
    isAuthenticated ? {} : "skip",
  );

  const [decryptedConfig, setDecryptedConfig] = useState<StoredConfig | null>(null);
  const [decryptedForId, setDecryptedForId] = useState<string | null>(null);
  const [localOverride, setLocalOverride] = useState<StoredConfig | null>(null);
  const [hasUserSaved, setHasUserSaved] = useState(false);
  const [convexAuthTimedOut, setConvexAuthTimedOut] = useState(false);

  const inflightRef = useRef<string | null>(null);

  // If Convex auth hasn't synced within 5s of Clerk sign-in, stop waiting
  useEffect(() => {
    if (!isSignedIn || isAuthenticated) return;
    const timer = setTimeout(() => setConvexAuthTimedOut(true), 5000);
    return () => clearTimeout(timer);
  }, [isSignedIn, isAuthenticated]);

  const storedKeysId = storedKeys
    ? `${storedKeys.encryptedData}:${storedKeys.iv}`
    : storedKeys === null
      ? "empty"
      : null;

  useEffect(() => {
    if (!isAuthenticated || !user || storedKeys === undefined || !storedKeys) return;

    const id = `${storedKeys.encryptedData}:${storedKeys.iv}`;
    if (inflightRef.current === id || decryptedForId === id) return;
    inflightRef.current = id;

    const data = storedKeys;
    const userId = user.id;
    let cancelled = false;

    deriveKey(userId)
      .then((key) => decrypt(data.encryptedData, data.iv, key))
      .then((plaintext) => {
        if (cancelled) return;
        const parsed = migrateConfig(JSON.parse(plaintext) as StoredConfig);
        const activeKey = parsed.providerKeys?.[parsed.providerId] ?? parsed.llmKey;
        const materialized = { ...parsed, llmKey: activeKey };
        localStorage.setItem(lsKey(userId), JSON.stringify(materialized));
        setDecryptedConfig(materialized);
        setDecryptedForId(id);
      })
      .catch(() => {
        if (cancelled) return;
        setDecryptedConfig(null);
        setDecryptedForId(id);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user, storedKeysId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDecrypting = useMemo(() => {
    if (!storedKeysId || storedKeysId === "empty") return false;
    return storedKeysId !== decryptedForId;
  }, [storedKeysId, decryptedForId]);

  const config: StoredConfig | null = useMemo(() => {
    if (hasUserSaved && localOverride) return localOverride;

    if (isAuthenticated && storedKeys !== undefined) {
      if (storedKeys === null) {
        // Server record is empty — preserve local cache so keys saved
        // during the Convex-auth timeout window are not discarded.
        if (user) return readLocalCache(user.id);
        return null;
      }
      if (!isDecrypting) return decryptedConfig;
      return null;
    }

    if (isSignedIn && user) {
      return readLocalCache(user.id);
    }

    return null;
  }, [hasUserSaved, localOverride, isAuthenticated, storedKeys, isDecrypting, decryptedConfig, isSignedIn, user]);

  const loading: boolean = useMemo(() => {
    if (!authLoaded) return true;
    if (!isSignedIn) return false;
    if (hasUserSaved) return false;

    // If Convex auth is synced, wait for query + decryption
    if (isAuthenticated) {
      return storedKeys === undefined || isDecrypting;
    }

    // Convex auth not yet synced — fall back to local cache if available
    if (user && readLocalCache(user.id)) return false;

    // No local cache — wait for Convex auth, but give up after 5s
    if (convexAuthTimedOut) return false;
    return true;
  }, [authLoaded, isSignedIn, hasUserSaved, isAuthenticated, storedKeys, isDecrypting, user, convexAuthTimedOut]);

  const save = useCallback(
    async (newConfig: StoredConfig) => {
      const providerKeys = { ...(newConfig.providerKeys ?? {}) };
      if (newConfig.providerId && newConfig.llmKey) {
        providerKeys[newConfig.providerId] = newConfig.llmKey;
      }
      const toStore = { ...newConfig, providerKeys };
      setLocalOverride(toStore);
      setHasUserSaved(true);
      if (user) {
        localStorage.setItem(lsKey(user.id), JSON.stringify(toStore));
      }
      if (isAuthenticated && user) {
        const key = await deriveKey(user.id);
        const { ciphertext, iv } = await encrypt(JSON.stringify(toStore), key);
        await saveToConvex({ encryptedData: ciphertext, iv });
      }
    },
    [isAuthenticated, user, saveToConvex],
  );

  // Sync local-only saves to Convex once auth becomes available
  useEffect(() => {
    if (!isAuthenticated || !user || !localOverride) return;
    let cancelled = false;
    (async () => {
      const key = await deriveKey(user.id);
      const { ciphertext, iv } = await encrypt(JSON.stringify(localOverride), key);
      if (!cancelled) {
        await saveToConvex({ encryptedData: ciphertext, iv });
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, user, localOverride, saveToConvex]);

  const clear = useCallback(async () => {
    setLocalOverride(null);
    setHasUserSaved(false);
    setDecryptedConfig(null);
    setDecryptedForId(null);
    inflightRef.current = null;
    if (user) {
      localStorage.removeItem(lsKey(user.id));
    }
    if (isAuthenticated) {
      await removeFromConvex({});
    }
  }, [isAuthenticated, user, removeFromConvex]);

  return { config, loading, save, clear };
}
