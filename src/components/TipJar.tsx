import { useState, useEffect, useCallback, useRef } from "react";
import {
  isConnected,
  getAddress,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";
import {
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Account,
  Contract,
  nativeToScVal,
  scValToNative,
  rpc,
} from "@stellar/stellar-sdk";
import { io, Socket } from "socket.io-client";
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

const STELLAR_PUBLIC_KEY_RE = /^G[A-Z2-7]{55}$/;
const HORIZON = "https://horizon-testnet.stellar.org";
const RPC_URL = "https://soroban-testnet.stellar.org";
const NET = Networks.TESTNET;
const BACKEND = "http://localhost:3001";

type WalletType = "freighter" | "albedo" | "lobstr" | "xbull";

interface Campaign {
  owner: string;
  goal: string;
  totalRaised: string;
  deadline: number;
  title: string;
  description: string;
}

interface DonorInfo {
  donor: string;
  amount: string;
  timestamp: number;
}

interface TxStatus {
  hash: string;
  status: "pending" | "success" | "error";
  message: string;
}

interface DonationEvent {
  donor: string;
  amount: string;
  hash: string;
  timestamp: number;
}

function isValidAddress(addr: string): boolean {
  return typeof addr === "string" && STELLAR_PUBLIC_KEY_RE.test(addr);
}

const CONTRACT_ID_KEY = "crowdfund_contract_id";

export default function TipJar() {
  const [address, setAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType>("freighter");
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<TxStatus | null>(null);
  const [donationAmount, setDonationAmount] = useState("");

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [donors, setDonors] = useState<DonorInfo[]>([]);
  const [donorCount, setDonorCount] = useState(0);
  const [recentDonations, setRecentDonations] = useState<DonationEvent[]>([]);

  const [contractId, setContractId] = useState<string>(() => {
    return localStorage.getItem(CONTRACT_ID_KEY) || "";
  });
  const [editingContract, setEditingContract] = useState(false);
  const [contractInput, setContractInput] = useState(contractId);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const s = io(BACKEND, { transports: ["websocket", "polling"] });
    socketRef.current = s;

    s.on("connect", () => {
      if (contractId) {
        s.emit("subscribe:campaign", { contractId });
      }
    });

    s.on("donation:new", (data: DonationEvent) => {
      setRecentDonations((prev) => [data, ...prev].slice(0, 50));
    });

    s.on("campaign:updated", () => {
      fetchCampaign();
      fetchDonors();
    });

    return () => { s.disconnect(); };
  }, [contractId]);

  useEffect(() => {
    if (contractId) {
      localStorage.setItem(CONTRACT_ID_KEY, contractId);
      fetchCampaign();
      fetchDonors();
      syncContractId();
    }
  }, [contractId]);

  useEffect(() => {
    const saved = sessionStorage.getItem("walletAddress");
    if (saved && isValidAddress(saved)) {
      setAddress(saved);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const allowed = await isConnected();
        if (allowed.error || cancelled) return;
        const a = await getAddress();
        if (a.error || cancelled) return;
        if (!isValidAddress(a.address)) return;
        sessionStorage.setItem("walletAddress", a.address);
        setAddress(a.address);
        setWalletType("freighter");
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const fetchCampaign = useCallback(async () => {
    if (!contractId) return;
    try {
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(contractId);
      const result = await server.simulateContract({
        fee: "100",
        contract: contract.address,
        method: "get_campaign",
        args: [],
      });
      if (rpc.Api.isSimulationSuccess(result)) {
        const parsed = scValToNative(result.result!) as any;
        setCampaign({
          owner: parsed.owner?.toString() || "",
          goal: (Number(parsed.goal) / 1e7).toString(),
          totalRaised: (Number(parsed.total_raised) / 1e7).toString(),
          deadline: Number(parsed.deadline),
          title: parsed.title?.toString() || "Campaign",
          description: parsed.description?.toString() || "",
        });
      }
    } catch (e) {
      console.warn("fetchCampaign error:", e);
    }
  }, [contractId]);

  const fetchDonors = useCallback(async () => {
    if (!contractId) return;
    try {
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(contractId);
      const countResult = await server.simulateContract({
        fee: "100",
        contract: contract.address,
        method: "get_donor_count",
        args: [],
      });
      if (rpc.Api.isSimulationSuccess(countResult)) {
        const count = Number(scValToNative(countResult.result!));
        setDonorCount(count);
        if (count > 0) {
          const donorsResult = await server.simulateContract({
            fee: "100",
            contract: contract.address,
            method: "get_donors",
            args: [
              nativeToScVal(0, { type: "u32" }),
              nativeToScVal(Math.min(count, 100), { type: "u32" }),
            ],
          });
          if (rpc.Api.isSimulationSuccess(donorsResult)) {
            const donorList = scValToNative(donorsResult.result!) as any[];
            setDonors(
              donorList.map((d: any) => ({
                donor: d.donor?.toString() || "",
                amount: (Number(d.amount) / 1e7).toString(),
                timestamp: Number(d.timestamp),
              }))
            );
          }
        }
      }
    } catch (e) {
      console.warn("fetchDonors error:", e);
    }
  }, [contractId]);

  const syncContractId = async () => {
    try {
      const res = await fetch(`${BACKEND}/api/contract-id`);
      const data = await res.json();
      if (data.contractId && data.contractId !== contractId) {
        setContractId(data.contractId);
        localStorage.setItem(CONTRACT_ID_KEY, data.contractId);
      }
    } catch {}
  };

  const saveContractId = async () => {
    const cid = contractInput.trim();
    if (!cid) return;
    setContractId(cid);
    localStorage.setItem(CONTRACT_ID_KEY, cid);
    setEditingContract(false);
    try {
      await fetch(`${BACKEND}/api/contract-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: cid }),
      });
    } catch {}
  };

  const connectFreighter = async () => {
    const a = await requestAccess();
    if (a.error) throw new Error("Wallet access denied. Please allow access in Freighter.");
    if (!isValidAddress(a.address)) throw new Error("Freighter returned an invalid address.");
    sessionStorage.setItem("walletAddress", a.address);
    setAddress(a.address);
  };

  const connectAlbedo = async () => {
    const albedo = (window as any).albedo;
    if (!albedo?.publicKey) throw new Error("Albedo not detected. Install the Albedo wallet.");
    const res = await albedo.publicKey({ allowAllAccounts: true });
    if (!res?.publicKey) throw new Error("Albedo access was denied.");
    sessionStorage.setItem("walletAddress", res.publicKey);
    setAddress(res.publicKey);
  };

  const connectLobstr = async () => {
    const lobstr = (window as any).lobstr;
    if (!lobstr?.connect) throw new Error("LOBSTR not detected. Install the LOBSTR wallet.");
    const res = await lobstr.connect();
    if (!res?.publicKey) throw new Error("LOBSTR access was denied.");
    sessionStorage.setItem("walletAddress", res.publicKey);
    setAddress(res.publicKey);
  };

  const connectXbull = async () => {
    const xbull = (window as any).xbull;
    if (!xbull?.connect) throw new Error("xBull not detected. Install the xBull wallet.");
    const res = await xbull.connect();
    if (!res?.publicKey) throw new Error("xBull access was denied.");
    sessionStorage.setItem("walletAddress", res.publicKey);
    setAddress(res.publicKey);
  };

  const connectWallet = async (type: WalletType) => {
    setShowWalletPicker(false);
    setBusy(true);
    setTx(null);
    try {
      setWalletType(type);
      switch (type) {
        case "freighter": await connectFreighter(); break;
        case "albedo": await connectAlbedo(); break;
        case "lobstr": await connectLobstr(); break;
        case "xbull": await connectXbull(); break;
      }
    } catch (err: any) {
      setTx({ hash: "", status: "error", message: err?.message || "Connection failed" });
    } finally {
      setBusy(false);
    }
  };

  const signWithWallet = async (xdr: string, opts: { networkPassphrase: string; address: string }) => {
    switch (walletType) {
      case "freighter": {
        const signed = await signTransaction(xdr, { networkPassphrase: opts.networkPassphrase });
        if (signed.error || !signed.signedTxXdr) throw new Error("Signing cancelled");
        return signed.signedTxXdr;
      }
      case "albedo": {
        const a = (window as any).albedo;
        const res = await a.tx({ xdr, network: opts.networkPassphrase.includes("public") ? "public" : "testnet" });
        return res.signedTxXdr;
      }
      case "lobstr": {
        const l = (window as any).lobstr;
        const res = await l.signTransaction(xdr);
        return res.signedTxXdr;
      }
      case "xbull": {
        const x = (window as any).xbull;
        const res = await x.signTransaction(xdr);
        return res.signedTxXdr;
      }
      default:
        throw new Error("Unknown wallet type");
    }
  };

  const disconnect = () => {
    sessionStorage.removeItem("walletAddress");
    setAddress(null);
    setTx(null);
    setDonationAmount("");
  };

  const short = (s: string) => `${s.slice(0, 4)}...${s.slice(-4)}`;

  const donate = async () => {
    if (!address || !contractId || !donationAmount || parseFloat(donationAmount) <= 0) return;

    setBusy(true);
    setTx({ hash: "", status: "pending", message: "Building transaction..." });

    try {
      const amountStroop = BigInt(Math.floor(parseFloat(donationAmount) * 1e7));
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(contractId);
      const sourceAccount = await server.getAccount(address);

      const scParams = [
        nativeToScVal(address, { type: "address" }),
        nativeToScVal(amountStroop, { type: "i128" }),
      ];

      const txn = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: NET,
      })
        .addOperation(contract.call("donate", ...scParams))
        .setTimeout(30);

      const simResp = await server.simulateContract(txn.build());
      if (!simResp || simResp.error) throw new Error(simResp?.error || "Simulation failed");
      if (!rpc.Api.isSimulationSuccess(simResp)) throw new Error("Contract simulation failed");

      const fee = String(Number(BASE_FEE) + 10000);
      const preparedTxn = rpc.assembleTransaction(txn.build(), NET, simResp, fee);
      const xdr = preparedTxn.toXDR();
      const signedTxXdr = await signWithWallet(xdr, { networkPassphrase: NET, address });

      setTx({ hash: "", status: "pending", message: "Submitting transaction..." });
      const sendResponse = await server.sendTransaction(signedTxXdr);

      if (sendResponse.status === "PENDING" || sendResponse.status === "DUPLICATE") {
        setTx({ hash: sendResponse.hash, status: "pending", message: "Waiting for confirmation..." });

        let getResponse = await server.getTransaction(sendResponse.hash);
        let retries = 0;
        while (getResponse.status === "NOT_FOUND" && retries < 30) {
          await new Promise((r) => setTimeout(r, 1000));
          getResponse = await server.getTransaction(sendResponse.hash);
          retries++;
        }

        if (getResponse.status === "SUCCESS") {
          setTx({ hash: sendResponse.hash, status: "success", message: `Donated ${donationAmount} XLM!` });
          try {
            await fetch(`${BACKEND}/api/donation`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ donor: address, amount: donationAmount, hash: sendResponse.hash }),
            });
          } catch {}
          fetchCampaign();
        } else {
          setTx({ hash: sendResponse.hash, status: "error", message: `Transaction failed: ${getResponse.status}` });
        }
      } else {
        setTx({ hash: sendResponse.hash || "", status: "error", message: `Failed: ${sendResponse.error || "submission failed"}` });
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("cancelled") || msg.includes("denied") || msg.includes("rejected")) {
        setTx({ hash: "", status: "error", message: "Transaction was cancelled by user." });
      } else if (msg.includes("insufficient") || msg.includes("low reserve") || msg.includes("op_no_trust")) {
        setTx({ hash: "", status: "error", message: "Insufficient balance for this donation." });
      } else if (msg.includes("not found") || msg.includes("no account")) {
        setTx({ hash: "", status: "error", message: "Account not funded on testnet. Use Stellar Lab faucet." });
      } else {
        setTx({ hash: "", status: "error", message: msg || "Something went wrong" });
      }
    } finally {
      setBusy(false);
    }
  };

  const progress = campaign
    ? Math.min((parseFloat(campaign.totalRaised) / parseFloat(campaign.goal)) * 100, 100)
    : 0;

  const walletNames: Record<WalletType, string> = {
    freighter: "Freighter", albedo: "Albedo", lobstr: "LOBSTR", xbull: "xBull",
  };

  return (
    <section id="crowdfund" className="scroll-mt-20 mx-auto max-w-4xl px-4 py-16 md:py-24">
      <div className="text-center mb-8">
        <Badge variant="outline" className="mb-3">Stellar Soroban</Badge>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Crowdfunding Campaign</h2>
        <p className="mt-2 text-muted-foreground max-w-lg mx-auto">Support this project with a Stellar donation.</p>
      </div>

      <Card className="mx-auto max-w-2xl mb-6">
        <CardContent className="pt-4">
          {editingContract ? (
            <div className="flex gap-2 items-center">
              <Input value={contractInput} onChange={(e) => setContractInput(e.target.value)} placeholder="Contract address (C...)" className="font-mono text-xs" />
              <Button size="sm" onClick={saveContractId} disabled={!contractInput.trim()}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingContract(false)}>Cancel</Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground truncate font-mono">
                {contractId ? `Contract: ${short(contractId)}` : "No contract deployed yet"}
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditingContract(true)}>
                {contractId ? "Change" : "Set Contract"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{campaign?.title || "Campaign"}</CardTitle>
            <CardDescription>{campaign?.description || "Loading..."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {campaign ? (
              <>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Raised</span>
                    <span className="font-medium">{parseFloat(campaign.totalRaised).toFixed(2)} / {parseFloat(campaign.goal).toFixed(2)} XLM</span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{progress.toFixed(1)}% funded</span>
                    <span>{donorCount} donor{donorCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">Deadline: {new Date(Number(campaign.deadline) * 1000).toLocaleDateString()}</div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{contractId ? "Loading..." : "Set a contract address above."}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{address ? short(address) : "Connect Wallet"}</CardTitle>
            <CardDescription>{address ? `via ${walletNames[walletType]}` : "Connect to donate"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!address ? (
              <div className="space-y-2">
                {showWalletPicker ? (
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(walletNames) as WalletType[]).map((w) => (
                      <Button key={w} variant="outline" className="h-14 text-sm" onClick={() => connectWallet(w)} disabled={busy}>
                        {w === "freighter" ? "🛸" : w === "albedo" ? "🌞" : w === "lobstr" ? "🦞" : "🐂"} {walletNames[w]}
                      </Button>
                    ))}
                    <Button variant="ghost" className="col-span-2 h-8 text-xs" onClick={() => setShowWalletPicker(false)}>Cancel</Button>
                  </div>
                ) : (
                  <Button className="w-full" onClick={() => setShowWalletPicker(true)} disabled={busy}>Connect Wallet</Button>
                )}
              </div>
            ) : (
              <>
                <Input type="number" placeholder="Amount (XLM)" value={donationAmount} onChange={(e) => setDonationAmount(e.target.value)} min="0" step="0.01" disabled={busy} />
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={donate} disabled={busy || !donationAmount || parseFloat(donationAmount) <= 0 || !contractId}>
                    {busy ? "Processing..." : "Donate"}
                  </Button>
                  <Button variant="ghost" onClick={disconnect}>Disconnect</Button>
                </div>
              </>
            )}

            {tx && (
              <div className={`rounded-lg border px-3 py-2 text-sm ${tx.status === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : tx.status === "pending" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
                <p className="flex items-center gap-1.5">
                  <span>{tx.status === "success" ? "✅" : tx.status === "pending" ? "⏳" : "❌"}</span>
                  {tx.message}
                </p>
                {tx.hash && (
                  <a href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs underline underline-offset-2 hover:no-underline">
                    View on Stellar Expert →
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Donors</CardTitle>
            <CardDescription>{donorCount} total contributions</CardDescription>
          </CardHeader>
          <CardContent className="max-h-60 overflow-y-auto space-y-2">
            {donors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No donations yet. Be the first!</p>
            ) : (
              donors.slice().reverse().map((d, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm">
                  <span className="font-mono text-xs">{short(d.donor)}</span>
                  <span className="font-medium text-emerald-400">+{parseFloat(d.amount).toFixed(2)} XLM</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Live Feed
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </CardTitle>
            <CardDescription>Real-time donation events</CardDescription>
          </CardHeader>
          <CardContent className="max-h-60 overflow-y-auto space-y-2">
            {recentDonations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Waiting for donations...</p>
            ) : (
              recentDonations.map((d, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2 text-sm">
                  <div>
                    <span className="font-mono text-xs">{short(d.donor)}</span>
                    <a href={`https://stellar.expert/explorer/testnet/tx/${d.hash}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-muted-foreground underline">tx</a>
                  </div>
                  <span className="font-medium text-emerald-400">+{parseFloat(d.amount).toFixed(2)} XLM</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
