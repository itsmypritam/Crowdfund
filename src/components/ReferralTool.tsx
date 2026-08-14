import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BACKEND_URL, isValidAddress } from "@/lib/config";
import { connectFreighter, getFreighterAddress, getSavedAddress } from "@/lib/wallet";

interface ReferralInfo {
  code: string;
  uses: number;
  clicks: number;
}

export default function ReferralTool() {
  const [address, setAddress] = useState<string | null>(getSavedAddress());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState<ReferralInfo | null>(null);
  const [copied, setCopied] = useState(false);

  const [redeemCode, setRedeemCode] = useState("");
  const [redeemMessage, setRedeemMessage] = useState<string | null>(null);
  const [incomingCode, setIncomingCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("ref");
    if (code) setIncomingCode(code.toUpperCase());
  }, []);

  const loadReferral = async (addr: string) => {
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/referrals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: addr }),
      });
      if (!res.ok) throw new Error("Could not create your referral code.");
      const data = await res.json();
      setRef({ code: data.code, uses: data.uses, clicks: data.clicks });
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    }
  };

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const addr = await connectFreighter();
      setAddress(addr);
      await loadReferral(addr);
    } catch (err: any) {
      setError(err?.message || "Connection failed.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (address && !ref) {
      loadReferral(address);
    }
  }, [address]);

  const shareLink = ref ? `${window.location.origin}/referrals?ref=${ref.code}` : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const doRedeem = async (code: string) => {
    if (!address || !code.trim()) return;
    setBusy(true);
    setRedeemMessage(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/referrals/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase(), wallet: address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not redeem referral.");
      setRedeemMessage("Referral redeemed — thanks for supporting the community!");
      setRedeemCode("");
      if (ref) loadReferral(address);
    } catch (err: any) {
      setRedeemMessage(err?.message || "Could not redeem referral.");
    } finally {
      setBusy(false);
    }
  };

  const redeem = () => doRedeem(redeemCode);

  return (
    <div className="space-y-6">
      {incomingCode && address && (
        <Card className="border-emerald-500/30">
          <CardContent className="pt-6">
            <p className="text-sm">
              🎉 You arrived via referral <Badge variant="outline">{incomingCode}</Badge>.{" "}
              <Button
                size="sm"
                className="ml-2"
                onClick={() => doRedeem(incomingCode)}
                disabled={busy}
              >
                Redeem it
              </Button>
            </p>
          </CardContent>
        </Card>
      )}

      {!address ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Referral Hub</CardTitle>
            <CardDescription>
              Connect your wallet to get a shareable code, or redeem a friend&apos;s code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-start gap-3 sm:flex-row">
              <Button onClick={connect} disabled={busy}>
                {busy ? "Connecting…" : "Connect Freighter"}
              </Button>
              <span className="self-center text-xs text-muted-foreground">
                or paste your address below
              </span>
              <Input
                className="sm:max-w-70 font-mono text-xs"
                placeholder="G..."
                value={address ?? ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (isValidAddress(v)) {
                    setAddress(v);
                    loadReferral(v);
                  }
                }}
              />
            </div>
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Your Referral Code</CardTitle>
              <CardDescription>
                Share this link — new supporters who redeem it are tracked for you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && <p className="text-sm text-red-400">{error}</p>}
              {ref ? (
                <>
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 p-4">
                    <Badge className="font-mono text-base">{ref.code}</Badge>
                    <Button size="sm" onClick={copyLink}>
                      {copied ? "Copied!" : "Copy link"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-center sm:max-w-xs">
                    <div className="rounded-lg border border-border/50 p-3">
                      <div className="text-2xl font-bold">{ref.uses}</div>
                      <div className="text-xs text-muted-foreground">Redeemed</div>
                    </div>
                    <div className="rounded-lg border border-border/50 p-3">
                      <div className="text-2xl font-bold">{ref.clicks}</div>
                      <div className="text-xs text-muted-foreground">Link clicks</div>
                    </div>
                  </div>
                  <p className="break-all font-mono text-xs text-muted-foreground">{shareLink}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Generating your code…</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Redeem a Referral</CardTitle>
              <CardDescription>
                Enter the code shared by a friend to support them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  className="font-mono uppercase"
                  placeholder="e.g. ABCDE234"
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                />
                <Button onClick={redeem} disabled={busy || !redeemCode.trim()}>
                  Redeem
                </Button>
              </div>
              {redeemMessage && <p className="text-sm text-muted-foreground">{redeemMessage}</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
