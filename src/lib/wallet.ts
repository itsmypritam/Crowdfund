import { isConnected, getAddress, requestAccess } from "@stellar/freighter-api";
import { isValidAddress } from "./config";

export async function getFreighterAddress(): Promise<string | null> {
  try {
    const allowed = await isConnected();
    if (!allowed.isConnected) return null;
    const a = await getAddress();
    if (a.error || !isValidAddress(a.address)) return null;
    return a.address;
  } catch {
    return null;
  }
}

export async function connectFreighter(): Promise<string> {
  const a = await requestAccess();
  if (a.error) throw new Error("Wallet access denied. Please allow access in Freighter.");
  if (!isValidAddress(a.address)) throw new Error("Freighter returned an invalid address.");
  sessionStorage.setItem("walletAddress", a.address);
  return a.address;
}

export function getSavedAddress(): string | null {
  const saved = sessionStorage.getItem("walletAddress");
  return saved && isValidAddress(saved) ? saved : null;
}

export function short(s: string, keep = 4): string {
  return s.length > keep * 2 + 3 ? `${s.slice(0, keep)}...${s.slice(-keep)}` : s;
}
