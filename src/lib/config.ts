import { Networks } from "@stellar/stellar-sdk";

export type StellarNetwork = "testnet" | "mainnet";

const STELLAR_NETWORK = (import.meta.env.PUBLIC_STELLAR_NETWORK || "testnet") as StellarNetwork;

export const NETWORK: StellarNetwork = STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";
export const NET: string =
  NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
export const HORIZON_URL: string =
  import.meta.env.PUBLIC_HORIZON_URL ||
  (NETWORK === "mainnet"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org");
export const RPC_URL: string =
  import.meta.env.PUBLIC_RPC_URL ||
  (NETWORK === "mainnet"
    ? "https://soroban-rpc.stellar.org"
    : "https://soroban-testnet.stellar.org");

const TESTNET_NATIVE_TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const MAINNET_NATIVE_TOKEN = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
export const NATIVE_TOKEN: string =
  NETWORK === "mainnet" ? MAINNET_NATIVE_TOKEN : TESTNET_NATIVE_TOKEN;

export const BACKEND_URL: string =
  import.meta.env.PUBLIC_BACKEND_URL || "https://crowdfund-enq9.onrender.com";
export const WS_URL: string = BACKEND_URL.replace(/^http/, "ws");
export const EXPLORER_URL: string =
  NETWORK === "mainnet"
    ? "https://stellar.expert/explorer/public"
    : "https://stellar.expert/explorer/testnet";

export const STELLAR_PUBLIC_KEY_RE = /^G[A-Z2-7]{55}$/;
export function isValidAddress(addr: string): boolean {
  return typeof addr === "string" && STELLAR_PUBLIC_KEY_RE.test(addr);
}
