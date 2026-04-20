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
}

function lsKey(userId: string): string {
  return `tryskills-config-${userId}`;
}

function readLocalCache(userId: string): StoredConfig | null {
  try {
    const raw = localStorage.getItem(lsKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConfig;
    if (parsed.llmKey && parsed.sandboxKey) return parsed;
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

  const inflightRef = useRef<string | null>(null);

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
        const parsed = JSON.parse(plaintext) as StoredConfig;
        localStorage.setItem(lsKey(userId), JSON.stringify(parsed));
        setDecryptedConfig(parsed);
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
      if (storedKeys === null) return null;
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

    // Wait for Convex auth to sync before resolving — prevents
    // briefly treating configured users as unconfigured on fresh browsers
    if (!isAuthenticated) return true;

    return storedKeys === undefined || isDecrypting;
  }, [authLoaded, isSignedIn, hasUserSaved, isAuthenticated, storedKeys, isDecrypting]);

  const save = useCallback(
    async (newConfig: StoredConfig) => {
      setLocalOverride(newConfig);
      setHasUserSaved(true);
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
