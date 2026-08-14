import { useEffect, useState } from "react";
import TipJar from "./TipJar";
import { Button } from "@/components/ui/button";

const CONTRACT_ID_RE = /^C[A-Z2-7]{55}$/;

export default function CampaignFallback() {
  const [path, setPath] = useState<string | null>(null);

  useEffect(() => {
    setPath(window.location.pathname);
  }, []);

  if (path === null) return null;

  const match = path.match(/^\/campaigns\/(C[A-Z2-7]{55})\/?$/);
  if (match) return <TipJar contractId={match[1]} />;

  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Campaign not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        That campaign doesn't exist or the link is invalid.
      </p>
      <a href="/campaigns">
        <Button className="mt-6">Browse Campaigns</Button>
      </a>
    </div>
  );
}
