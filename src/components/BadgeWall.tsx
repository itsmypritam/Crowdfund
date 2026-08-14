import { useEffect, useState, useCallback } from "react";
import { Account, Contract, TransactionBuilder, nativeToScVal, scValToNative, rpc } from "@stellar/stellar-sdk";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NET, RPC_URL } from "@/lib/config";
import { connectFreighter, getFreighterAddress, getSavedAddress } from "@/lib/wallet";

const SIM_SOURCE = "GBRLJZKCAANA7A3XU6RB4643VPIEKXH5R76GIQAWS2V6JRU37N3JAFCA";

interface BadgeInfo {
  name: string;
  description: string;
}

const BADGE_STYLE: Record<string, string> = {
  Supporter: "border-purple-500/40 text-purple-300",
  "Gold Supporter": "border-amber-500/50 text-amber-300",
  Reviewer: "border-emerald-500/40 text-emerald-300",
  "Refund Claimant": "border-rose-500/40 text-rose-300",
  Creator: "border-indigo-500/40 text-indigo-300",
  Deliverer: "border-sky-500/40 text-sky-300",
};

export default function BadgeWall({ contractId }: { contractId: string }) {
  const [address, setAddress] = useState<string | null>(getSavedAddress());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badges, setBadges] = useState<BadgeInfo[]>([]);

  const load = useCallback(async (addr: string) => {
    if (!contractId) return;
    setBusy(true);
    setError(null);
    try {
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(contractId);
      const simSource = new Account(SIM_SOURCE, "0");
      const tx = new TransactionBuilder(simSource, { fee: "100", networkPassphrase: NET })
        .addOperation(contract.call("get_badges", nativeToScVal(addr, { type: "address" })))
        .setTimeout(30)
        .build();
      const result = await server.simulateTransaction(tx);
      if (!rpc.Api.isSimulationSuccess(result) || !result.result) {
        setError("Could not read badges on-chain.");
        return;
      }
      const raw = scValToNative(result.result.retval) as any[];
      setBadges(
        Array.isArray(raw)
          ? raw.map((b) => ({ name: b?.name?.toString() || "", description: b?.description?.toString() || "" }))
          : []
      );
    } catch (err: any) {
      setError(err?.message || "Could not load badges.");
    } finally {
      setBusy(false);
    }
  }, [contractId]);

  useEffect(() => {
    if (address) {
      getFreighterAddress().then((addr) => {
        if (addr && addr !== address) setAddress(addr);
      });
      load(address);
    }
  }, [address, contractId, load]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const addr = await connectFreighter();
      setAddress(addr);
      await load(addr);
    } catch (err: any) {
      setError(err?.message || "Connection failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mx-auto mt-10 max-w-2xl">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">🏅 Badges</CardTitle>
            <CardDescription>
              Earned on-chain for this campaign — read straight from the contract.
            </CardDescription>
          </div>
          {address && (
            <Button variant="outline" size="sm" onClick={() => load(address)} disabled={busy}>
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        {!address ? (
          <div className="flex flex-col items-start gap-3">
            <Button onClick={connect} disabled={busy}>
              {busy ? "Connecting…" : "Connect to see badges"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Supporter, Gold Supporter, Reviewer, Refund Claimant, Creator, Deliverer.
            </p>
          </div>
        ) : badges.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No badges yet. Donate, approve milestones, or create a campaign to earn them.
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {badges.map((b) => (
              <div
                key={b.name}
                title={b.description}
                className="flex items-center gap-2 rounded-lg border px-3 py-2"
              >
                <span className="text-lg">🏅</span>
                <div>
                  <Badge variant="outline" className={BADGE_STYLE[b.name]}>
                    {b.name}
                  </Badge>
                  <p className="mt-0.5 max-w-56 text-xs text-muted-foreground">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
