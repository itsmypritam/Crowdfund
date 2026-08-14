import { useEffect, useState } from "react";
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

interface Campaign {
  id: string;
  owner: string;
  goal: number;
  totalRaised: number;
  deadline: number;
  title: string;
  description: string;
  status: string;
  createdAt: number;
}

function short(s: string) {
  return s.length > 12 ? `${s.slice(0, 6)}...${s.slice(-4)}` : s;
}

export default function CampaignBrowse() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/campaigns`);
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = await res.json();
        if (!cancelled) setCampaigns(Array.isArray(data) ? data : []);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Could not load campaigns.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ended = (deadline: number) => Date.now() > deadline;

  if (loading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-5 w-2/3 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-3 rounded-full bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardContent className="pt-6">
          <p className="text-sm text-red-400">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (campaigns.length === 0) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">No campaigns yet.</p>
          <a href="/#crowdescrow">
            <Button className="mt-4">Start a Campaign</Button>
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {campaigns.map((c) => {
        const progress = c.goal > 0 ? Math.min((c.totalRaised / c.goal) * 100, 100) : 0;
        return (
          <a key={c.id} href={`/campaigns/${c.id}`} className="group">
            <Card className="h-full transition-colors hover:border-primary/30">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg leading-snug">{c.title || "Untitled"}</CardTitle>
                  <Badge variant={ended(c.deadline) ? "secondary" : "default"}>
                    {ended(c.deadline) ? "Ended" : "Active"}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2">{c.description || "…"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {c.totalRaised.toFixed(2)} / {c.goal.toFixed(2)} XLM
                  </span>
                  <span>{progress.toFixed(0)}%</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">{short(c.owner)}</span>
                  <span>Ends {new Date(c.deadline).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          </a>
        );
      })}
    </div>
  );
}
