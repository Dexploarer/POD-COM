import { PodComClient } from "@pod-protocol/sdk";
import { getNetworkEndpoint, loadKeypair, getServerUrl } from "./config.js";
import { Keypair } from "@solana/web3.js";

export async function createClient(
  network?: string,
  wallet?: any,
): Promise<PodComClient> {
  const client = new PodComClient({
    endpoint: getNetworkEndpoint(network),
    commitment: "confirmed",
    serverUrl: getServerUrl(),
  });
  await client.initialize(wallet);
  return client;
}

export function getWallet(keypairPath?: string): any {
  const keypair = loadKeypair(keypairPath);

  // Return wallet-like interface that Anchor expects
  return {
    publicKey: keypair.publicKey,
    signTransaction: async (tx: any) => {
      tx.partialSign(keypair);
      return tx;
    },
    signAllTransactions: async (txs: any[]) => {
      return txs.map((tx) => {
        tx.partialSign(keypair);
        return tx;
      });
    },
  };
}

export function getKeypair(keypairPath?: string): Keypair {
  return loadKeypair(keypairPath);
}
