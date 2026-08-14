import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Activity, Wallet, Coins, Users, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const BACKEND = "https://crowdfund-enq9.onrender.com";

interface AnalyticsSummary {
  totalRequests: number;
  walletConnects: number;
  donations: number;
  feedbackCount: number;
  uniqueVisitors: number;
}

interface DailyStat {
  date: string;
  requests: number;
  connects: number;
  donations: number;
}

interface AnalyticsEvent {
  type: string;
  timestamp?: number;
  txHash?: string;
  wallet?: string;
  address?: string;
  donor?: string;
  amount?: string;
}

interface Feedback {
  wallet: string;
  rating: number | null;
  message: string;
  timestamp: number;
}

const EVENT_LABEL: Record<string, string> = {
  request: "Request",
  wallet_connect: "Wallet Connect",
  donation: "Donation",
  feedback: "Feedback",
};

const EVENT_COLOR: Record<string, string> = {
  request: "bg-slate-500",
  wallet_connect: "bg-indigo-500",
  donation: "bg-emerald-500",
  feedback: "bg-pink-500",
};

function short(s: string) {
  return s.length > 12 ? `${s.slice(0, 6)}...${s.slice(-4)}` : s;
}

export default function AnalyticsTab() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [daily, setDaily] = useState<DailyStat[]>([]);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [analyticsRes, feedbackRes] = await Promise.all([
        fetch(`${BACKEND}/api/analytics`),
        fetch(`${BACKEND}/api/feedback`),
      ]);
      if (!analyticsRes.ok || !feedbackRes.ok) throw new Error("Failed to load analytics");
      const analytics = await analyticsRes.json();
      const feedbackData = await feedbackRes.json();
      setSummary(analytics.summary);
      setDaily(analytics.daily || []);
      setEvents((analytics.recentEvents || []).filter((e: AnalyticsEvent) => e.type !== "request").slice(0, 20));
      setFeedback(Array.isArray(feedbackData) ? feedbackData.slice().reverse().slice(0, 10) : []);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err?.message || "Could not reach the analytics backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const maxDonations = Math.max(1, ...daily.map((d) => d.donations));
  const avgRating = feedback.length
    ? (feedback.reduce((acc, f) => acc + (f.rating || 0), 0) / feedback.length).toFixed(1)
    : "—";

  const statCards = [
    { label: "Total Requests", value: summary?.totalRequests ?? "—", icon: Activity, tone: "text-slate-400" },
    { label: "Wallet Connects", value: summary?.walletConnects ?? "—", icon: Wallet, tone: "text-indigo-400" },
    { label: "Donations", value: summary?.donations ?? "—", icon: Coins, tone: "text-emerald-400" },
    { label: "Unique Visitors", value: summary?.uniqueVisitors ?? "—", icon: Users, tone: "text-amber-400" },
    { label: "Feedback", value: summary?.feedbackCount ?? "—", icon: MessageSquare, tone: "text-pink-400" },
  ];

  return (
    <section id="analytics" className="scroll-mt-20 mx-auto max-w-5xl px-4 py-16 md:py-24">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <Badge variant="outline" className="mb-3">Live Analytics</Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Activity &amp; Feedback</h2>
          <p className="mt-2 text-muted-foreground max-w-lg">
            Real-time usage, donation activity and user feedback captured by the backend.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading..." : "Refresh"}
          </Button>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!error && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
            {statCards.map((s) => (
              <Card key={s.label} size="sm">
                <CardContent className="flex items-center gap-3">
                  <s.icon className={`size-5 ${s.tone}`} />
                  <div>
                    <div className="text-2xl font-bold">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Daily Activity (last 7 days)</CardTitle>
              <CardDescription>Donations per day across the campaign</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-2 sm:gap-4 h-32">
                {daily.map((d) => (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground font-medium">{d.donations}</span>
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-indigo-600 to-emerald-400 transition-all duration-500"
                      style={{ height: `${Math.max((d.donations / maxDonations) * 100, 4)}%` }}
                      title={`${d.date}: ${d.donations} donations`}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(d.date + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "short" })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Events</CardTitle>
                <CardDescription>Latest activity (excluding page requests)</CardDescription>
              </CardHeader>
              <CardContent className="max-h-80 overflow-y-auto space-y-2">
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                ) : (
                  events.map((e, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`size-2 shrink-0 rounded-full ${EVENT_COLOR[e.type] || "bg-slate-500"}`} />
                        <span className="font-medium whitespace-nowrap">{EVENT_LABEL[e.type] || e.type}</span>
                        {e.txHash && (
                          <a
                            href={`https://stellar.expert/explorer/testnet/tx/${e.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate font-mono text-xs text-muted-foreground underline underline-offset-2"
                          >
                            {short(e.txHash)}
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {e.amount && <span className="font-medium text-emerald-400">{e.amount} XLM</span>}
                        <span className="text-xs text-muted-foreground">
                          {e.timestamp ? new Date(e.timestamp).toLocaleDateString() : ""}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Feedback</CardTitle>
                <CardDescription>
                  {feedback.length ? `Average rating ${avgRating} / 5` : "No feedback submitted yet"}
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-80 overflow-y-auto space-y-2">
                {feedback.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No feedback submitted yet.</p>
                ) : (
                  feedback.map((f, i) => (
                    <div key={i} className="rounded-lg bg-muted/30 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs">{short(f.wallet)}</span>
                        <span className="flex items-center gap-1">
                          {f.rating ? (
                            <span className="text-xs text-amber-400">{"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)}</span>
                          ) : null}
                          <span className="text-xs text-muted-foreground">
                            {new Date(f.timestamp).toLocaleDateString()}
                          </span>
                        </span>
                      </div>
                      {f.message && <p className="mt-1 text-xs text-muted-foreground">{f.message}</p>}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
