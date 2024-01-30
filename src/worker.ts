/* eslint-disable fp/no-loops, fp/no-mutation, fp/no-mutating-methods, fp/no-let */

import "@solana/webcrypto-ed25519-polyfill";
import { getAddressFromPublicKey } from "@solana/web3.js";

interface Params {
  count: number;
  batchSize: number;
  criteria: Criteria;
}

type Criteria =
  | {
    start: string;
  }
  | {
    end: string;
  }
  | {
    start: string;
    end: string;
  };

onmessage = (event) =>
  (async () => {
    const params: Params = event.data;
    const batchSize = params.batchSize || 10;

    const isMatch = (() => {
      const criteria = params.criteria;
      if ("start" in criteria && "end" in criteria) {
        return (addr: string) =>
          addr.startsWith(criteria.start) && addr.endsWith(criteria.end);
      } else if ("start" in criteria) {
        return (addr: string) => addr.startsWith(criteria.start);
      } else {
        return (addr: string) => addr.endsWith(criteria.end);
      }
    })();

    let count = 0;
    const keys: CryptoKeyPair[] = [];

    await Promise.all([
      (async () => {
        while (count < params.count) {
          try {
            const keypairs = await generateKeypairs(batchSize);
            for (const keypair of keypairs) {
              const addr = await getAddressFromPublicKey(keypair.publicKey);
              if (isMatch(addr)) {
                postMessage({ match: await exportBytes(keypair) });
              }
              count++;
              if (count % 100 === 0) {
                postMessage({ count });
              }
            }
          } catch (_e) {
            console.error("op1 fail");
          }
        }
      })()
    ]);
    postMessage({ exit: count });
  })().catch((e) => {
    postMessage({ error: e.message });
  });

async function exportBytes(keypair: CryptoKeyPair): Promise<Uint8Array> {
  const [exportedPublicKey, exportedPrivateKey] = await Promise.all([
    crypto.subtle.exportKey("raw", keypair.publicKey),
    crypto.subtle.exportKey("pkcs8", keypair.privateKey),
  ]);

  const solanaKey = new Uint8Array(64);
  solanaKey.set(new Uint8Array(exportedPrivateKey).slice(16));
  solanaKey.set(new Uint8Array(exportedPublicKey), 32);
  return solanaKey;
}

async function generateKeypairs(batchSize: number): Promise<CryptoKeyPair[]> {
  const keypairs = [];
  for (let i = 0; i < batchSize; i++) {
    const keypair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
    keypairs.push(keypair);
  }
  return keypairs;
}