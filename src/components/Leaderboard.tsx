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
import { short } from "@/lib/wallet";

interface LeaderboardEntry {
  rank: number;
  donor: string;
  total: number;
  donations: number;
  lastDonation: number;
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [totalDonors, setTotalDonors] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/leaderboard?limit=50`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setTotalDonors(data.totalDonors ?? 0);
    } catch (err: any) {
      setError(err?.message || "Could not load the leaderboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const medal = (rank: number) =>
    rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl">Top Supporters</CardTitle>
              <CardDescription>
                Ranked by total XLM pledged across all campaigns.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No supporters yet. Be the first to pledge on a campaign.
            </p>
          ) : (
            <div className="space-y-2">
              {entries.map((e) => (
                <div
                  key={e.donor}
                  className="flex items-center gap-4 rounded-lg border border-border/50 px-4 py-2.5"
                >
                  <span className="w-10 text-sm font-semibold text-muted-foreground">
                    {medal(e.rank)}
                  </span>
                  <span className="flex-1 font-mono text-sm">{short(e.donor)}</span>
                  <Badge variant="outline">{e.donations} donation{e.donations === 1 ? "" : "s"}</Badge>
                  <span className="text-sm font-semibold text-emerald-400">
                    {e.total.toFixed(2)} XLM
                  </span>
                </div>
              ))}
              <p className="pt-2 text-xs text-muted-foreground">
                {totalDonors} total supporter{totalDonors === 1 ? "" : "s"} tracked on-chain.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
