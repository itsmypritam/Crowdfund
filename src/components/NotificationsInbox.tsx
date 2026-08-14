import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BACKEND_URL } from "@/lib/config";
import { connectFreighter, getFreighterAddress, getSavedAddress } from "@/lib/wallet";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  campaignId: string;
  link: string;
  read: boolean;
  createdAt: number;
}

const TYPE_ICON: Record<string, string> = {
  welcome: "👋",
  donation: "💜",
  refund: "💸",
  approval: "✅",
  proof: "📜",
  milestone: "🚩",
  campaign: "🎯",
  referral: "🤝",
};

export default function NotificationsInbox() {
  const [address, setAddress] = useState<string | null>(getSavedAddress());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async (addr: string) => {
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/notifications?wallet=${encodeURIComponent(addr)}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
      setUnread(Array.isArray(data) ? data.filter((n) => !n.read).length : 0);
    } catch (err: any) {
      setError(err?.message || "Could not load notifications.");
    }
  }, []);

  useEffect(() => {
    if (address) {
      getFreighterAddress().then((addr) => {
        if (addr && addr !== address) setAddress(addr);
      });
      load(address);
    }
  }, [address, load]);

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

  const markAllRead = async () => {
    if (!address) return;
    setBusy(true);
    try {
      await fetch(`${BACKEND_URL}/api/notifications/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address }),
      });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch {
      setError("Failed to mark notifications as read.");
    } finally {
      setBusy(false);
    }
  };

  const sendDemo = async () => {
    if (!address) return;
    setBusy(true);
    try {
      await fetch(`${BACKEND_URL}/api/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: address,
          type: "welcome",
          title: "Welcome to CrowdEscrow 🎯",
          body: "Your inbox is live. You'll see pledge, approval, and refund updates here.",
        }),
      });
      await load(address);
    } catch {
      setError("Failed to send the demo notification.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {!address ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Notifications</CardTitle>
            <CardDescription>
              Connect your wallet to see pledge, approval, and refund updates for your campaigns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={connect} disabled={busy}>
              {busy ? "Connecting…" : "Connect Freighter"}
            </Button>
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl">
                  Notifications{" "}
                  {unread > 0 && <Badge className="ml-1">{unread} new</Badge>}
                </CardTitle>
                <CardDescription>
                  Updates for your wallet and campaigns.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={sendDemo} disabled={busy}>
                  Send demo
                </Button>
                <Button variant="outline" size="sm" onClick={markAllRead} disabled={busy || unread === 0}>
                  Mark all read
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No notifications yet. Send a demo notification to see how it works.
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
                      n.read ? "border-border/40 opacity-70" : "border-primary/30 bg-primary/[0.03]"
                    }`}
                  >
                    <span className="text-xl">{TYPE_ICON[n.type] ?? "🔔"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{n.title}</p>
                      {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
