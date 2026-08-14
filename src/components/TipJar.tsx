import { useState, useEffect, useCallback, useRef } from "react";
import {
  isConnected,
  getAddress,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";
import {
  Transaction,
  TransactionBuilder,
  BASE_FEE,
  Account,
  Contract,
  Operation,
  Address,
  nativeToScVal,
  scValToNative,
  rpc,
} from "@stellar/stellar-sdk";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trackEvent } from "@/lib/analytics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  RPC_URL,
  NET,
  BACKEND_URL,
  WS_URL,
  EXPLORER_URL,
  NATIVE_TOKEN,
  isValidAddress,
} from "@/lib/config";

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

interface MilestoneInfo {
  id: number;
  description: string;
  amount: string;
  deadline: number;
  approvals: number;
  requiredApprovals: number;
  released: boolean;
  completed: boolean;
  missed: boolean;
  refunded: string;
}

interface ProofInfo {
  id: number;
  milestoneId: number;
  description: string;
  proofHash: string;
  timestamp: number;
}

const CONTRACT_ID_KEY = "crowdescrow_contract_id";
const SIM_SOURCE = "GBRLJZKCAANA7A3XU6RB4643VPIEKXH5R76GIQAWS2V6JRU37N3JAFCA";

interface TipJarProps {
  contractId?: string;
}

export default function TipJar({ contractId: propContractId }: TipJarProps) {
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
    return propContractId || localStorage.getItem(CONTRACT_ID_KEY) || "";
  });
  const [editingContract, setEditingContract] = useState(false);
  const [contractInput, setContractInput] = useState(contractId);

  const [milestones, setMilestones] = useState<MilestoneInfo[]>([]);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [msDescription, setMsDescription] = useState("");
  const [msAmount, setMsAmount] = useState("");
  const [msDeadline, setMsDeadline] = useState("");
  const [msApprovals, setMsApprovals] = useState("1");

  const [proofsByMs, setProofsByMs] = useState<Record<number, ProofInfo[]>>({});
  const [votesByMs, setVotesByMs] = useState<Record<number, number>>({});
  const [votedByMs, setVotedByMs] = useState<Record<number, boolean>>({});
  const [refundedByMs, setRefundedByMs] = useState<Record<number, boolean>>({});
  const [donorTotal, setDonorTotal] = useState("0");
  const [escrowed, setEscrowed] = useState("0");
  const [proofFormFor, setProofFormFor] = useState<number | null>(null);
  const [proofDesc, setProofDesc] = useState("");
  const [proofHash, setProofHash] = useState("");

  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (propContractId && propContractId !== contractId) {
      setContractId(propContractId);
    }
  }, [propContractId]);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    socketRef.current = ws;

    ws.onopen = () => {
      if (contractId) {
        ws.send(JSON.stringify({ type: "subscribe:campaign", campaignId: contractId }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "donation:new") {
          setRecentDonations((prev) => [data, ...prev].slice(0, 50));
        } else if (data.type === "campaign:updated") {
          fetchCampaign();
          fetchDonors();
        }
      } catch {}
    };

    return () => { ws.close(); };
  }, [contractId]);

  useEffect(() => {
    if (contractId) {
      localStorage.setItem(CONTRACT_ID_KEY, contractId);
      fetchCampaign();
      fetchDonors();
      fetchMilestones();
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

  const campaignRegisteredRef = useRef<string | null>(null);

  const registerCampaign = useCallback(async (c: Campaign) => {
    if (!contractId || campaignRegisteredRef.current === contractId) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: contractId,
          owner: c.owner,
          goal: c.goal,
          deadline: new Date(Number(c.deadline) * 1000).toISOString(),
          title: c.title,
          description: c.description,
        }),
      });
      if (res.ok || res.status === 409) campaignRegisteredRef.current = contractId;
    } catch {}
  }, [contractId]);

  const fetchCampaign = useCallback(async () => {
    if (!contractId) return;
    try {
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(contractId);
      const simSource = new Account(SIM_SOURCE, "0");
      const simTx = new TransactionBuilder(simSource, {
        fee: "100",
        networkPassphrase: NET,
      })
        .addOperation(contract.call("get_campaign"))
        .setTimeout(30)
        .build();
      const result = await server.simulateTransaction(simTx);
      if (rpc.Api.isSimulationSuccess(result) && result.result) {
        const parsed = scValToNative(result.result.retval) as any;
        const campaign: Campaign = {
          owner: parsed.owner?.toString() || "",
          goal: (Number(parsed.goal) / 1e7).toString(),
          totalRaised: (Number(parsed.total_raised) / 1e7).toString(),
          deadline: Number(parsed.deadline),
          title: parsed.title?.toString() || "Campaign",
          description: parsed.description?.toString() || "",
        };
        setCampaign(campaign);
        registerCampaign(campaign);
      }
    } catch (e) {
      console.warn("fetchCampaign error:", e);
    }
  }, [contractId, registerCampaign]);

  const fetchDonors = useCallback(async () => {
    if (!contractId) return;
    try {
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(contractId);
      const simSource = new Account(SIM_SOURCE, "0");

      const countTx = new TransactionBuilder(simSource, {
        fee: "100",
        networkPassphrase: NET,
      })
        .addOperation(contract.call("get_donor_count"))
        .setTimeout(30)
        .build();
      const countResult = await server.simulateTransaction(countTx);
      if (rpc.Api.isSimulationSuccess(countResult) && countResult.result) {
        const count = Number(scValToNative(countResult.result.retval));
        setDonorCount(count);
        if (count > 0) {
          const donorsTx = new TransactionBuilder(simSource, {
            fee: "100",
            networkPassphrase: NET,
          })
            .addOperation(contract.call("get_donors",
              nativeToScVal(0, { type: "u32" }),
              nativeToScVal(Math.min(count, 100), { type: "u32" }),
            ))
            .setTimeout(30)
            .build();
          const donorsResult = await server.simulateTransaction(donorsTx);
          if (rpc.Api.isSimulationSuccess(donorsResult) && donorsResult.result) {
            const donorList = scValToNative(donorsResult.result.retval) as any[];
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

  const fetchMilestones = useCallback(async () => {
    if (!contractId) return;
    try {
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(contractId);
      const simSource = new Account(SIM_SOURCE, "0");

      const countTx = new TransactionBuilder(simSource, {
        fee: "100",
        networkPassphrase: NET,
      })
        .addOperation(contract.call("get_milestone_count"))
        .setTimeout(30)
        .build();
      const countResult = await server.simulateTransaction(countTx);
      if (rpc.Api.isSimulationSuccess(countResult) && countResult.result) {
        const count = Number(scValToNative(countResult.result.retval));
        if (count > 0) {
          const msTx = new TransactionBuilder(simSource, {
            fee: "100",
            networkPassphrase: NET,
          })
            .addOperation(contract.call("get_milestones",
              nativeToScVal(0, { type: "u32" }),
              nativeToScVal(Math.min(count, 100), { type: "u32" }),
            ))
            .setTimeout(30)
            .build();
          const msResult = await server.simulateTransaction(msTx);
          if (rpc.Api.isSimulationSuccess(msResult) && msResult.result) {
            const msList = scValToNative(msResult.result.retval) as any[];
            setMilestones(
              msList.map((m: any) => ({
                id: Number(m.id),
                description: m.description?.toString() || "",
                amount: (Number(m.amount) / 1e7).toString(),
                deadline: Number(m.deadline),
                approvals: Number(m.approvals),
                requiredApprovals: Number(m.required_approvals),
                released: Boolean(m.released),
                completed: Boolean(m.completed),
                missed: Boolean(m.missed),
                refunded: (Number(m.refunded) / 1e7).toString(),
              }))
            );
          }
        }
      }
    } catch (e) {
      console.warn("fetchMilestones error:", e);
    }
  }, [contractId]);

  const refreshDeliverables = useCallback(async () => {
    if (!contractId || milestones.length === 0) return;
    try {
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(contractId);
      const simSource = new Account(SIM_SOURCE, "0");

      const call = async (method: string, args: any[] = []) => {
        const tx = new TransactionBuilder(simSource, {
          fee: "100",
          networkPassphrase: NET,
        })
          .addOperation(contract.call(method, ...args))
          .setTimeout(30)
          .build();
        const result = await server.simulateTransaction(tx);
        if (rpc.Api.isSimulationSuccess(result) && result.result) {
          return scValToNative(result.result.retval);
        }
        return null;
      };

      const proofs: Record<number, ProofInfo[]> = {};
      const votes: Record<number, number> = {};
      for (const m of milestones) {
        const p = await call("get_proofs", [nativeToScVal(m.id, { type: "u32" })]);
        if (Array.isArray(p)) {
          proofs[m.id] = p.map((x: any) => ({
            id: Number(x.id),
            milestoneId: Number(x.milestone_id),
            description: x.description?.toString() || "",
            proofHash: x.proof_hash?.toString() || "",
            timestamp: Number(x.timestamp),
          }));
        }
        const v = await call("get_missed_vote_count", [nativeToScVal(m.id, { type: "u32" })]);
        if (v != null) votes[m.id] = Number(v);
      }
      setProofsByMs(proofs);
      setVotesByMs(votes);

      const esc = await call("get_total_escrowed");
      if (esc != null) setEscrowed((Number(esc) / 1e7).toString());

      if (address) {
        const dt = await call("get_donor_total", [nativeToScVal(address, { type: "address" })]);
        if (dt != null) setDonorTotal((Number(dt) / 1e7).toString());
        const voted: Record<number, boolean> = {};
        const refunded: Record<number, boolean> = {};
        for (const m of milestones) {
          const hv = await call("has_voted", [
            nativeToScVal(m.id, { type: "u32" }),
            nativeToScVal(address, { type: "address" }),
          ]);
          if (hv != null) voted[m.id] = Boolean(hv);
          const hr = await call("has_refunded", [
            nativeToScVal(m.id, { type: "u32" }),
            nativeToScVal(address, { type: "address" }),
          ]);
          if (hr != null) refunded[m.id] = Boolean(hr);
        }
        setVotedByMs(voted);
        setRefundedByMs(refunded);
      } else {
        setDonorTotal("0");
        setVotedByMs({});
        setRefundedByMs({});
      }
    } catch (e) {
      console.warn("refreshDeliverables error:", e);
    }
  }, [contractId, milestones, address]);

  useEffect(() => {
    if (contractId && milestones.length > 0) {
      refreshDeliverables();
    }
  }, [contractId, milestones, address, refreshDeliverables]);

  const syncContractId = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/contract-id`);
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
      await fetch(`${BACKEND_URL}/api/contract-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: cid }),
      });
    } catch {}
  };

  const connectFreighter = async (): Promise<string> => {
    const a = await requestAccess();
    if (a.error) throw new Error("Wallet access denied. Please allow access in Freighter.");
    if (!isValidAddress(a.address)) throw new Error("Freighter returned an invalid address.");
    sessionStorage.setItem("walletAddress", a.address);
    setAddress(a.address);
    return a.address;
  };

  const connectAlbedo = async (): Promise<string> => {
    const albedo = (window as any).albedo;
    if (!albedo?.publicKey) throw new Error("Albedo not detected. Install the Albedo wallet.");
    const res = await albedo.publicKey({ allowAllAccounts: true });
    if (!res?.publicKey) throw new Error("Albedo access was denied.");
    sessionStorage.setItem("walletAddress", res.publicKey);
    setAddress(res.publicKey);
    return res.publicKey;
  };

  const connectLobstr = async (): Promise<string> => {
    const lobstr = (window as any).lobstr;
    if (!lobstr?.connect) throw new Error("LOBSTR not detected. Install the LOBSTR wallet.");
    const res = await lobstr.connect();
    if (!res?.publicKey) throw new Error("LOBSTR access was denied.");
    sessionStorage.setItem("walletAddress", res.publicKey);
    setAddress(res.publicKey);
    return res.publicKey;
  };

  const connectXbull = async (): Promise<string> => {
    const xbull = (window as any).xbull;
    if (!xbull?.connect) throw new Error("xBull not detected. Install the xBull wallet.");
    const res = await xbull.connect();
    if (!res?.publicKey) throw new Error("xBull access was denied.");
    sessionStorage.setItem("walletAddress", res.publicKey);
    setAddress(res.publicKey);
    return res.publicKey;
  };

  const connectWallet = async (type: WalletType) => {
    setShowWalletPicker(false);
    setBusy(true);
    setTx(null);
    try {
      setWalletType(type);
      let connectedAddress = "";
      switch (type) {
        case "freighter": connectedAddress = await connectFreighter(); break;
        case "albedo": connectedAddress = await connectAlbedo(); break;
        case "lobstr": connectedAddress = await connectLobstr(); break;
        case "xbull": connectedAddress = await connectXbull(); break;
      }
      trackEvent("wallet_connect", { wallet: type });
      fetch(`${BACKEND_URL}/api/analytics/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "wallet_connect", wallet: type, address: connectedAddress }),
      }).catch(() => {});
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

      const builtTx = txn.build();
      const simResp = await server.simulateTransaction(builtTx, undefined, "record");
      if (!simResp || simResp.error) throw new Error(simResp?.error || "Simulation failed");
      if (!rpc.Api.isSimulationSuccess(simResp)) throw new Error("Contract simulation failed");

      const preparedTxn = rpc.assembleTransaction(builtTx, simResp);
      const xdr = preparedTxn.build().toXDR();
      const signedTxXdr = await signWithWallet(xdr, { networkPassphrase: NET, address });

      setTx({ hash: "", status: "pending", message: "Submitting transaction..." });
      const sendResponse = await server.sendTransaction(new Transaction(signedTxXdr, NET));

      if (sendResponse.status === "PENDING" || sendResponse.status === "DUPLICATE") {
        let getResponse = await server.getTransaction(sendResponse.hash);
        let retries = 0;
        while (getResponse.status === "NOT_FOUND" && retries < 30) {
          await new Promise((r) => setTimeout(r, 1000));
          getResponse = await server.getTransaction(sendResponse.hash);
          retries++;
        }

        if (getResponse.status === "SUCCESS") {
          setTx({ hash: sendResponse.hash, status: "success", message: `Donated ${donationAmount} XLM!` });
          trackEvent("donate", { amount: donationAmount, wallet: walletType });
          fetch(`${BACKEND_URL}/api/analytics/event`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "donation", amount: donationAmount, wallet: walletType, address }),
          }).catch(() => {});
          try {
            await fetch(`${BACKEND_URL}/api/donations`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ campaignId: contractId, donor: address, amount: donationAmount, hash: sendResponse.hash }),
            });
          } catch {}
          fetchCampaign();
          fetchMilestones();
          refreshDeliverables();
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

  const [showInitForm, setShowInitForm] = useState(false);
  const [initTitle, setInitTitle] = useState("");
  const [initDesc, setInitDesc] = useState("");
  const [initGoal, setInitGoal] = useState("");
  const [initDeadline, setInitDeadline] = useState("");

  const initCampaign = async () => {
    if (!address || !contractId || !initTitle || !initGoal || !initDeadline) return;

    setBusy(true);
    setTx({ hash: "", status: "pending", message: "Initializing campaign..." });

    try {
      const goalStroop = BigInt(Math.floor(parseFloat(initGoal) * 1e7));
      const deadlineTs = BigInt(Math.floor(new Date(initDeadline).getTime() / 1000));
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(contractId);
      const sourceAccount = await server.getAccount(address);

      const scParams = [
        nativeToScVal(address, { type: "address" }),
        nativeToScVal(goalStroop, { type: "i128" }),
        nativeToScVal(deadlineTs, { type: "u64" }),
        nativeToScVal(initTitle, { type: "string" }),
        nativeToScVal(initDesc, { type: "string" }),
        nativeToScVal(NATIVE_TOKEN, { type: "address" }),
      ];

      const txn = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: NET,
      })
        .addOperation(contract.call("initialize", ...scParams))
        .setTimeout(30);

      const builtTx = txn.build();
      const simResp = await server.simulateTransaction(builtTx, undefined, "record");
      if (!simResp || simResp.error) throw new Error(simResp?.error || "Simulation failed");
      if (!rpc.Api.isSimulationSuccess(simResp)) throw new Error("Contract simulation failed");

      const preparedTxn = rpc.assembleTransaction(builtTx, simResp);
      const xdr = preparedTxn.build().toXDR();
      const signedTxXdr = await signWithWallet(xdr, { networkPassphrase: NET, address });

      setTx({ hash: "", status: "pending", message: "Submitting initialize transaction..." });
      const sendResponse = await server.sendTransaction(new Transaction(signedTxXdr, NET));

      if (sendResponse.status === "PENDING" || sendResponse.status === "DUPLICATE") {
        let getResponse = await server.getTransaction(sendResponse.hash);
        let retries = 0;
        while (getResponse.status === "NOT_FOUND" && retries < 30) {
          await new Promise((r) => setTimeout(r, 1000));
          getResponse = await server.getTransaction(sendResponse.hash);
          retries++;
        }

        if (getResponse.status === "SUCCESS") {
          setTx({ hash: sendResponse.hash, status: "success", message: "Campaign initialized!" });
          setShowInitForm(false);
          fetchCampaign();
          fetchMilestones();
        } else {
          setTx({ hash: sendResponse.hash, status: "error", message: `Initialize failed: ${getResponse.status}` });
        }
      } else {
        setTx({ hash: sendResponse.hash || "", status: "error", message: `Failed: ${sendResponse.error || "submission failed"}` });
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("cancelled") || msg.includes("denied") || msg.includes("rejected")) {
        setTx({ hash: "", status: "error", message: "Transaction was cancelled by user." });
      } else if (msg.includes("already initialized")) {
        setTx({ hash: "", status: "error", message: "Campaign already initialized." });
      } else {
        setTx({ hash: "", status: "error", message: msg || "Something went wrong" });
      }
    } finally {
      setBusy(false);
    }
  };

  const withdrawFunds = async () => {
    if (!address || !contractId) return;

    setBusy(true);
    setTx({ hash: "", status: "pending", message: "Withdrawing funds..." });

    try {
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(contractId);
      const sourceAccount = await server.getAccount(address);

      const scParams = [
        nativeToScVal(address, { type: "address" }),
      ];

      const txn = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: NET,
      })
        .addOperation(contract.call("withdraw", ...scParams))
        .setTimeout(30);

      const builtTx = txn.build();
      const simResp = await server.simulateTransaction(builtTx, undefined, "record");
      if (!simResp || simResp.error) throw new Error(simResp?.error || "Simulation failed");
      if (!rpc.Api.isSimulationSuccess(simResp)) throw new Error("Contract simulation failed");

      const preparedTxn = rpc.assembleTransaction(builtTx, simResp);
      const xdr = preparedTxn.build().toXDR();
      const signedTxXdr = await signWithWallet(xdr, { networkPassphrase: NET, address });

      setTx({ hash: "", status: "pending", message: "Submitting withdraw transaction..." });
      const sendResponse = await server.sendTransaction(new Transaction(signedTxXdr, NET));

      if (sendResponse.status === "PENDING" || sendResponse.status === "DUPLICATE") {
        let getResponse = await server.getTransaction(sendResponse.hash);
        let retries = 0;
        while (getResponse.status === "NOT_FOUND" && retries < 30) {
          await new Promise((r) => setTimeout(r, 1000));
          getResponse = await server.getTransaction(sendResponse.hash);
          retries++;
        }

        if (getResponse.status === "SUCCESS") {
          setTx({ hash: sendResponse.hash, status: "success", message: "Funds withdrawn!" });
          fetchCampaign();
          fetchMilestones();
        } else {
          setTx({ hash: sendResponse.hash, status: "error", message: `Withdraw failed: ${getResponse.status}` });
        }
      } else {
        setTx({ hash: sendResponse.hash || "", status: "error", message: `Failed: ${sendResponse.error || "submission failed"}` });
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("cancelled") || msg.includes("denied") || msg.includes("rejected")) {
        setTx({ hash: "", status: "error", message: "Transaction was cancelled by user." });
      } else if (msg.includes("not yet ended") || msg.includes("goal not reached")) {
        setTx({ hash: "", status: "error", message: "Campaign not yet ended or goal not reached." });
      } else if (msg.includes("no funds")) {
        setTx({ hash: "", status: "error", message: "No funds to withdraw." });
      } else {
        setTx({ hash: "", status: "error", message: msg || "Something went wrong" });
      }
    } finally {
      setBusy(false);
    }
  };

  const [deploying, setDeploying] = useState(false);
  const deployTx = useRef(false);

  const deployContract = async () => {
    if (!address || deployTx.current) return;

    setBusy(true);
    setDeploying(true);
    deployTx.current = true;
    setTx({ hash: "", status: "pending", message: "Preparing deploy..." });

    try {
      const { WASM_B64 } = await import("./wasm_base64");
      const wasmBytes = Uint8Array.from(atob(WASM_B64), (c) => c.charCodeAt(0));
      const hashBuffer = await crypto.subtle.digest("SHA-256", wasmBytes);
      const wasmHash = new Uint8Array(hashBuffer);

      const server = new rpc.Server(RPC_URL);
      const src = await server.getAccount(address);

      // Step 1: Upload WASM
      setTx({ hash: "", status: "pending", message: "Step 1/2: Uploading WASM..." });
      const uploadTx = new TransactionBuilder(src, { fee: BASE_FEE, networkPassphrase: NET })
        .addOperation(Operation.uploadContractWasm({ wasm: wasmBytes }))
        .setTimeout(300)
        .build();

      const uploadSim = await server.simulateTransaction(uploadTx);
      if (!uploadSim || uploadSim.error) throw new Error(uploadSim?.error || "sim failed");
      const uploadPrep = rpc.assembleTransaction(uploadTx, uploadSim);
      const uploadXdr = uploadPrep.build().toXDR();
      const uploadSigned = await signWithWallet(uploadXdr, { networkPassphrase: NET, address });
      const uploadResp = await server.sendTransaction(new Transaction(uploadSigned, NET));

      if (uploadResp.status !== "PENDING" && uploadResp.status !== "DUPLICATE") {
        throw new Error(uploadResp.error || "upload submit failed");
      }

      let uploadGet = await server.getTransaction(uploadResp.hash);
      let retries = 0;
      while (uploadGet.status === "NOT_FOUND" && retries < 60) {
        await new Promise((r) => setTimeout(r, 1000));
        uploadGet = await server.getTransaction(uploadResp.hash);
        retries++;
      }
      if (uploadGet.status !== "SUCCESS") throw new Error("Upload failed: " + uploadGet.status);

      // Step 2: Create contract
      setTx({ hash: "", status: "pending", message: "Step 2/2: Creating contract..." });
      const src2 = await server.getAccount(address);
      const createTx = new TransactionBuilder(src2, { fee: BASE_FEE, networkPassphrase: NET })
        .addOperation(Operation.createCustomContract({
          wasmHash,
          address: new Address(address),
        }))
        .setTimeout(300)
        .build();

      const createSim = await server.simulateTransaction(createTx);
      if (!createSim || createSim.error) throw new Error(createSim?.error || "sim failed");
      const createPrep = rpc.assembleTransaction(createTx, createSim);
      const createXdr = createPrep.build().toXDR();
      const createSigned = await signWithWallet(createXdr, { networkPassphrase: NET, address });
      const createResp = await server.sendTransaction(new Transaction(createSigned, NET));

      if (createResp.status !== "PENDING" && createResp.status !== "DUPLICATE") {
        throw new Error(createResp.error || "create submit failed");
      }

      let createGet = await server.getTransaction(createResp.hash);
      retries = 0;
      while (createGet.status === "NOT_FOUND" && retries < 60) {
        await new Promise((r) => setTimeout(r, 1000));
        createGet = await server.getTransaction(createResp.hash);
        retries++;
      }
      if (createGet.status !== "SUCCESS") throw new Error("Create failed: " + createGet.status);

      const newContractId = (createGet as any).contractId || "";
      if (newContractId) {
        setContractId(newContractId);
        setContractInput(newContractId);
        localStorage.setItem(CONTRACT_ID_KEY, newContractId);
        try { await fetch(`${BACKEND_URL}/api/contract-id`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contractId: newContractId }) }); } catch {}
      }
      setTx({ hash: createResp.hash, status: "success", message: newContractId ? `Contract: ${short(newContractId)}` : "Deployed!" });
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("cancelled") || msg.includes("denied")) {
        setTx({ hash: "", status: "error", message: "Deploy cancelled" });
      } else {
        setTx({ hash: "", status: "error", message: msg });
      }
    } finally {
      setBusy(false);
      setDeploying(false);
      deployTx.current = false;
    }
  };

  const addMilestone = async () => {
    if (!address || !contractId || !msDescription || !msAmount || !msDeadline) return;

    setBusy(true);
    setTx({ hash: "", status: "pending", message: "Adding milestone..." });

    try {
      const amountStroop = BigInt(Math.floor(parseFloat(msAmount) * 1e7));
      const deadlineTs = BigInt(Math.floor(new Date(msDeadline).getTime() / 1000));
      const reqApprovals = BigInt(parseInt(msApprovals) || 1);
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(contractId);
      const sourceAccount = await server.getAccount(address);

      const scParams = [
        nativeToScVal(msDescription, { type: "string" }),
        nativeToScVal(amountStroop, { type: "i128" }),
        nativeToScVal(deadlineTs, { type: "u64" }),
        nativeToScVal(reqApprovals, { type: "u32" }),
      ];

      const txn = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: NET,
      })
        .addOperation(contract.call("add_milestone", ...scParams))
        .setTimeout(30);

      const builtTx = txn.build();
      const simResp = await server.simulateTransaction(builtTx, undefined, "record");
      if (!simResp || simResp.error) throw new Error(simResp?.error || "Simulation failed");
      if (!rpc.Api.isSimulationSuccess(simResp)) throw new Error("Contract simulation failed");

      const preparedTxn = rpc.assembleTransaction(builtTx, simResp);
      const xdr = preparedTxn.build().toXDR();
      const signedTxXdr = await signWithWallet(xdr, { networkPassphrase: NET, address });

      setTx({ hash: "", status: "pending", message: "Submitting milestone transaction..." });
      const sendResponse = await server.sendTransaction(new Transaction(signedTxXdr, NET));

      if (sendResponse.status === "PENDING" || sendResponse.status === "DUPLICATE") {
        let getResponse = await server.getTransaction(sendResponse.hash);
        let retries = 0;
        while (getResponse.status === "NOT_FOUND" && retries < 30) {
          await new Promise((r) => setTimeout(r, 1000));
          getResponse = await server.getTransaction(sendResponse.hash);
          retries++;
        }

        if (getResponse.status === "SUCCESS") {
          setTx({ hash: sendResponse.hash, status: "success", message: "Milestone added!" });
          setShowMilestoneForm(false);
          setMsDescription("");
          setMsAmount("");
          setMsDeadline("");
          setMsApprovals("1");
          fetchMilestones();
          fetchCampaign();
        } else {
          setTx({ hash: sendResponse.hash, status: "error", message: `Add milestone failed: ${getResponse.status}` });
        }
      } else {
        setTx({ hash: sendResponse.hash || "", status: "error", message: `Failed: ${sendResponse.error || "submission failed"}` });
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("cancelled") || msg.includes("denied")) {
        setTx({ hash: "", status: "error", message: "Transaction was cancelled by user." });
      } else {
        setTx({ hash: "", status: "error", message: msg || "Something went wrong" });
      }
    } finally {
      setBusy(false);
    }
  };

  const approveMilestone = async (milestoneId: number) => {
    if (!address || !contractId) return;

    setBusy(true);
    setTx({ hash: "", status: "pending", message: `Approving milestone #${milestoneId}...` });

    try {
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(contractId);
      const sourceAccount = await server.getAccount(address);

      const scParams = [
        nativeToScVal(address, { type: "address" }),
        nativeToScVal(milestoneId, { type: "u32" }),
      ];

      const txn = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: NET,
      })
        .addOperation(contract.call("approve_milestone", ...scParams))
        .setTimeout(30);

      const builtTx = txn.build();
      const simResp = await server.simulateTransaction(builtTx, undefined, "record");
      if (!simResp || simResp.error) throw new Error(simResp?.error || "Simulation failed");
      if (!rpc.Api.isSimulationSuccess(simResp)) throw new Error("Contract simulation failed");

      const preparedTxn = rpc.assembleTransaction(builtTx, simResp);
      const xdr = preparedTxn.build().toXDR();
      const signedTxXdr = await signWithWallet(xdr, { networkPassphrase: NET, address });

      const sendResponse = await server.sendTransaction(new Transaction(signedTxXdr, NET));

      if (sendResponse.status === "PENDING" || sendResponse.status === "DUPLICATE") {
        let getResponse = await server.getTransaction(sendResponse.hash);
        let retries = 0;
        while (getResponse.status === "NOT_FOUND" && retries < 30) {
          await new Promise((r) => setTimeout(r, 1000));
          getResponse = await server.getTransaction(sendResponse.hash);
          retries++;
        }

        if (getResponse.status === "SUCCESS") {
          setTx({ hash: sendResponse.hash, status: "success", message: `Milestone #${milestoneId} approved!` });
          fetchMilestones();
        } else {
          setTx({ hash: sendResponse.hash, status: "error", message: `Approve failed: ${getResponse.status}` });
        }
      } else {
        setTx({ hash: sendResponse.hash || "", status: "error", message: `Failed: ${sendResponse.error || "submission failed"}` });
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("cancelled") || msg.includes("denied")) {
        setTx({ hash: "", status: "error", message: "Transaction was cancelled." });
      } else if (msg.includes("already approved")) {
        setTx({ hash: "", status: "error", message: "You already approved this milestone." });
      } else {
        setTx({ hash: "", status: "error", message: msg || "Something went wrong" });
      }
    } finally {
      setBusy(false);
    }
  };

  const releaseMilestone = async (milestoneId: number) => {
    if (!address || !contractId) return;

    setBusy(true);
    setTx({ hash: "", status: "pending", message: `Releasing milestone #${milestoneId}...` });

    try {
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(contractId);
      const sourceAccount = await server.getAccount(address);

      const scParams = [
        nativeToScVal(milestoneId, { type: "u32" }),
      ];

      const txn = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: NET,
      })
        .addOperation(contract.call("release_milestone", ...scParams))
        .setTimeout(30);

      const builtTx = txn.build();
      const simResp = await server.simulateTransaction(builtTx, undefined, "record");
      if (!simResp || simResp.error) throw new Error(simResp?.error || "Simulation failed");
      if (!rpc.Api.isSimulationSuccess(simResp)) throw new Error("Contract simulation failed");

      const preparedTxn = rpc.assembleTransaction(builtTx, simResp);
      const xdr = preparedTxn.build().toXDR();
      const signedTxXdr = await signWithWallet(xdr, { networkPassphrase: NET, address });

      const sendResponse = await server.sendTransaction(new Transaction(signedTxXdr, NET));

      if (sendResponse.status === "PENDING" || sendResponse.status === "DUPLICATE") {
        let getResponse = await server.getTransaction(sendResponse.hash);
        let retries = 0;
        while (getResponse.status === "NOT_FOUND" && retries < 30) {
          await new Promise((r) => setTimeout(r, 1000));
          getResponse = await server.getTransaction(sendResponse.hash);
          retries++;
        }

        if (getResponse.status === "SUCCESS") {
          setTx({ hash: sendResponse.hash, status: "success", message: `Milestone #${milestoneId} funds released!` });
          fetchMilestones();
          fetchCampaign();
        } else {
          setTx({ hash: sendResponse.hash, status: "error", message: `Release failed: ${getResponse.status}` });
        }
      } else {
        setTx({ hash: sendResponse.hash || "", status: "error", message: `Failed: ${sendResponse.error || "submission failed"}` });
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("cancelled") || msg.includes("denied")) {
        setTx({ hash: "", status: "error", message: "Transaction was cancelled." });
      } else if (msg.includes("not yet approved")) {
        setTx({ hash: "", status: "error", message: "Milestone not yet fully approved." });
      } else if (msg.includes("already released")) {
        setTx({ hash: "", status: "error", message: "Milestone already released." });
      } else {
        setTx({ hash: "", status: "error", message: msg || "Something went wrong" });
      }
    } finally {
      setBusy(false);
    }
  };

  const sendContractCall = async (opts: {
    method: string;
    scParams: any[];
    pendingMessage: string;
    successMessage: string;
    onSuccess?: () => void;
  }): Promise<boolean> => {
    if (!address || !contractId) return false;
    setBusy(true);
    setTx({ hash: "", status: "pending", message: opts.pendingMessage });
    try {
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(contractId);
      const sourceAccount = await server.getAccount(address);

      const txn = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: NET,
      })
        .addOperation(contract.call(opts.method, ...opts.scParams))
        .setTimeout(30);

      const builtTx = txn.build();
      const simResp = await server.simulateTransaction(builtTx, undefined, "record");
      if (!simResp || simResp.error) throw new Error(simResp?.error || "Simulation failed");
      if (!rpc.Api.isSimulationSuccess(simResp)) throw new Error("Contract simulation failed");

      const preparedTxn = rpc.assembleTransaction(builtTx, simResp);
      const xdr = preparedTxn.build().toXDR();
      const signedTxXdr = await signWithWallet(xdr, { networkPassphrase: NET, address });

      setTx({ hash: "", status: "pending", message: "Submitting transaction..." });
      const sendResponse = await server.sendTransaction(new Transaction(signedTxXdr, NET));

      if (sendResponse.status === "PENDING" || sendResponse.status === "DUPLICATE") {
        let getResponse = await server.getTransaction(sendResponse.hash);
        let retries = 0;
        while (getResponse.status === "NOT_FOUND" && retries < 30) {
          await new Promise((r) => setTimeout(r, 1000));
          getResponse = await server.getTransaction(sendResponse.hash);
          retries++;
        }
        if (getResponse.status === "SUCCESS") {
          setTx({ hash: sendResponse.hash, status: "success", message: opts.successMessage });
          opts.onSuccess?.();
          return true;
        }
        setTx({ hash: sendResponse.hash, status: "error", message: `Transaction failed: ${getResponse.status}` });
      } else {
        setTx({ hash: sendResponse.hash || "", status: "error", message: `Failed: ${sendResponse.error || "submission failed"}` });
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("cancelled") || msg.includes("denied") || msg.includes("rejected")) {
        setTx({ hash: "", status: "error", message: "Transaction was cancelled." });
      } else {
        setTx({ hash: "", status: "error", message: msg || "Something went wrong" });
      }
    } finally {
      setBusy(false);
    }
    return false;
  };

  const submitProof = async (milestoneId: number) => {
    if (!proofDesc.trim() || !proofHash.trim()) return;
    const ok = await sendContractCall({
      method: "submit_proof",
      scParams: [
        nativeToScVal(milestoneId, { type: "u32" }),
        nativeToScVal(proofDesc, { type: "string" }),
        nativeToScVal(proofHash, { type: "string" }),
      ],
      pendingMessage: `Submitting proof for milestone #${milestoneId}...`,
      successMessage: `Proof submitted for milestone #${milestoneId}!`,
      onSuccess: () => {
        setProofFormFor(null);
        setProofDesc("");
        setProofHash("");
        refreshDeliverables();
      },
    });
    void ok;
  };

  const voteMissed = async (milestoneId: number) => {
    const ok = await sendContractCall({
      method: "vote_missed",
      scParams: [
        nativeToScVal(address, { type: "address" }),
        nativeToScVal(milestoneId, { type: "u32" }),
      ],
      pendingMessage: `Voting milestone #${milestoneId} missed...`,
      successMessage: `Vote recorded for milestone #${milestoneId}!`,
      onSuccess: () => {
        fetchMilestones();
        refreshDeliverables();
      },
    });
    void ok;
  };

  const claimRefund = async (milestoneId: number) => {
    const ok = await sendContractCall({
      method: "request_refund",
      scParams: [
        nativeToScVal(address, { type: "address" }),
        nativeToScVal(milestoneId, { type: "u32" }),
      ],
      pendingMessage: `Claiming refund for milestone #${milestoneId}...`,
      successMessage: `Refund claimed for milestone #${milestoneId}!`,
      onSuccess: () => {
        fetchMilestones();
        fetchCampaign();
        refreshDeliverables();
      },
    });
    void ok;
  };

  const submitFeedback = async () => {
    if (!address || feedbackRating === 0) return;
    setBusy(true);
    try {
      await fetch(`${BACKEND_URL}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, rating: feedbackRating, message: feedbackMessage }),
      });
      setFeedbackSubmitted(true);
      setFeedbackRating(0);
      setFeedbackMessage("");
    } catch {
      setTx({ hash: "", status: "error", message: "Failed to submit feedback" });
    } finally {
      setBusy(false);
    }
  };

  const isOwner = address && campaign && address === campaign.owner;
  const progress = campaign
    ? Math.min((parseFloat(campaign.totalRaised) / parseFloat(campaign.goal)) * 100, 100)
    : 0;
  const deliveredCount = milestones.filter((m) => m.released).length;
  const missedCount = milestones.filter((m) => m.missed).length;
  const deliveryScore =
    deliveredCount + missedCount > 0
      ? Math.round((deliveredCount / (deliveredCount + missedCount)) * 100)
      : null;

  const walletNames: Record<WalletType, string> = {
    freighter: "Freighter", albedo: "Albedo", lobstr: "LOBSTR", xbull: "xBull",
  };

  return (
    <section id="crowdescrow" className="scroll-mt-20 mx-auto max-w-4xl px-4 py-16 md:py-24">
      <div className="text-center mb-8">
        <Badge variant="outline" className="mb-3">Stellar Soroban</Badge>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">CrowdEscrow Campaign</h2>
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
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingContract(true)}>
                    {contractId ? "Change" : "Set Contract"}
                  </Button>
                  {contractId && !campaign && !busy && (
                    <Button size="sm" onClick={() => setShowInitForm(true)}>
                      Init
                    </Button>
                  )}
                  {!contractId && address && !busy && (
                    <Button size="sm" onClick={deployContract}>
                      Deploy
                    </Button>
                  )}
                </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showInitForm && (
        <Card className="mx-auto max-w-2xl mb-6 border-indigo-500/30">
          <CardHeader>
            <CardTitle className="text-lg">Initialize Campaign</CardTitle>
            <CardDescription>Set up your CrowdEscrow campaign on-chain</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Title" value={initTitle} onChange={(e) => setInitTitle(e.target.value)} disabled={busy} />
            <Input placeholder="Description" value={initDesc} onChange={(e) => setInitDesc(e.target.value)} disabled={busy} />
            <Input type="number" placeholder="Goal (XLM)" value={initGoal} onChange={(e) => setInitGoal(e.target.value)} min="0" step="0.01" disabled={busy} />
            <Input type="datetime-local" value={initDeadline} onChange={(e) => setInitDeadline(e.target.value)} disabled={busy} />
            <div className="flex gap-2">
              <Button onClick={initCampaign} disabled={busy || !initTitle || !initGoal || !initDeadline}>
                {busy ? "Processing..." : "Initialize"}
              </Button>
              <Button variant="ghost" onClick={() => setShowInitForm(false)} disabled={busy}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                {milestones.length > 0 && (
                  <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Milestones delivered</span>
                      <span className="font-medium text-emerald-400">{deliveredCount} / {milestones.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Creator delivery score</span>
                      <span className="font-medium">{deliveryScore !== null ? `${deliveryScore}%` : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Escrowed (held on-chain)</span>
                      <span className="font-medium">{parseFloat(escrowed).toFixed(2)} XLM</span>
                    </div>
                  </div>
                )}
                {isOwner && (
                  <Button size="sm" variant="outline" className="w-full" onClick={withdrawFunds} disabled={busy}>
                    {busy ? "Processing..." : "Withdraw Funds"}
                  </Button>
                )}
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
                {parseFloat(donorTotal) > 0 && (
                  <p className="text-xs text-muted-foreground">Your contribution: {parseFloat(donorTotal).toFixed(2)} XLM</p>
                )}
              </>
            )}

            {tx && (
              <div className={`rounded-lg border px-3 py-2 text-sm ${tx.status === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : tx.status === "pending" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
                <p className="flex items-center gap-1.5">
                  <span>{tx.status === "success" ? "✅" : tx.status === "pending" ? "⏳" : "❌"}</span>
                  {tx.message}
                </p>
                {tx.hash && (
                  <a href={`${EXPLORER_URL}/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs underline underline-offset-2 hover:no-underline">
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
                    <a href={`${EXPLORER_URL}/tx/${d.hash}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-muted-foreground underline">tx</a>
                  </div>
                  <span className="font-medium text-emerald-400">+{parseFloat(d.amount).toFixed(2)} XLM</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold tracking-tight">Milestones</h3>
            <p className="text-sm text-muted-foreground">Escrow-protected milestone payments</p>
          </div>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={() => setShowMilestoneForm(!showMilestoneForm)} disabled={busy}>
              {showMilestoneForm ? "Cancel" : "+ Add Milestone"}
            </Button>
          )}
        </div>

        {showMilestoneForm && (
          <Card className="mb-4 border-indigo-500/30">
            <CardContent className="pt-4 space-y-3">
              <Input placeholder="Milestone description" value={msDescription} onChange={(e) => setMsDescription(e.target.value)} disabled={busy} />
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" placeholder="Amount (XLM)" value={msAmount} onChange={(e) => setMsAmount(e.target.value)} min="0" step="0.01" disabled={busy} />
                <Input type="number" placeholder="Required approvals" value={msApprovals} onChange={(e) => setMsApprovals(e.target.value)} min="1" disabled={busy} />
              </div>
              <Input type="datetime-local" value={msDeadline} onChange={(e) => setMsDeadline(e.target.value)} disabled={busy} />
              <Button onClick={addMilestone} disabled={busy || !msDescription || !msAmount || !msDeadline}>
                {busy ? "Processing..." : "Add Milestone"}
              </Button>
            </CardContent>
          </Card>
        )}

        {milestones.length === 0 ? (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground text-center">No milestones yet. {isOwner ? "Add milestones to release funds incrementally." : "Funds are held in escrow until milestones are met."}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {milestones.map((m) => {
              const deadlinePassed = Date.now() > m.deadline * 1000;
              const isDonor = address && parseFloat(donorTotal) > 0;
              const requiredVotes = Math.floor(donorCount / 2) + 1;
              const votes = votesByMs[m.id] ?? 0;
              const proofs = proofsByMs[m.id] ?? [];
              const hasVoted = !!votedByMs[m.id];
              const hasRefunded = !!refundedByMs[m.id];
              return (
                <Card key={m.id} className={m.released ? "border-emerald-500/30 opacity-70" : m.completed ? "border-amber-500/30" : ""}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={m.released ? "default" : m.missed ? "destructive" : m.completed ? "secondary" : "outline"}>
                            {m.released ? "Released" : m.missed ? "Missed" : m.completed ? "Approved" : "Pending"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">#{m.id}</span>
                        </div>
                        <p className="text-sm font-medium">{m.description}</p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{m.amount} XLM</span>
                          <span>{m.approvals}/{m.requiredApprovals} approvals</span>
                          <span>Deadline: {new Date(m.deadline * 1000).toLocaleDateString()}</span>
                        </div>
                        {m.missed && parseFloat(m.refunded) > 0 && (
                          <p className="mt-1 text-xs text-amber-400">{parseFloat(m.refunded).toFixed(2)} XLM refunded</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        {m.missed && !m.released && address && isDonor && (
                          <Button
                            size="sm"
                            onClick={() => claimRefund(m.id)}
                            disabled={busy || hasRefunded}
                            variant="outline"
                          >
                            {hasRefunded ? "Refunded ✓" : "Claim Refund"}
                          </Button>
                        )}
                        {deadlinePassed && !m.released && !m.completed && !m.missed && address && !isOwner && isDonor && !hasVoted && (
                          <Button size="sm" variant="outline" onClick={() => voteMissed(m.id)} disabled={busy}>
                            Vote Missed
                          </Button>
                        )}
                        {!deadlinePassed && !m.released && !m.completed && address && !isOwner && (
                          <Button size="sm" variant="outline" onClick={() => approveMilestone(m.id)} disabled={busy}>
                            Approve
                          </Button>
                        )}
                        {m.completed && !m.released && isOwner && (
                          <Button size="sm" onClick={() => releaseMilestone(m.id)} disabled={busy}>
                            Release
                          </Button>
                        )}
                      </div>
                    </div>

                    {deadlinePassed && !m.released && !m.completed && !m.missed && (
                      <div className="mt-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>Backer review — did the creator miss this milestone?</span>
                          <span>{votes}/{requiredVotes} votes to mark missed</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-destructive/70"
                            style={{ width: `${Math.min((votes / requiredVotes) * 100, 100)}%` }}
                          />
                        </div>
                        {hasVoted && <p className="mt-1 text-xs text-emerald-400">You voted to mark this milestone missed.</p>}
                      </div>
                    )}

                    {isOwner && !m.released && !m.completed && !m.missed && (
                      <div className="mt-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
                        {proofFormFor === m.id ? (
                          <div className="space-y-2">
                            <Input
                              placeholder="What did you deliver? (e.g. final design files)"
                              value={proofDesc}
                              onChange={(e) => setProofDesc(e.target.value)}
                              disabled={busy}
                            />
                            <Input
                              placeholder="Proof link or hash (URL, IPFS CID...)"
                              value={proofHash}
                              onChange={(e) => setProofHash(e.target.value)}
                              disabled={busy}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => submitProof(m.id)} disabled={busy || !proofDesc.trim() || !proofHash.trim()}>
                                {busy ? "Submitting..." : "Submit Proof"}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setProofFormFor(null)} disabled={busy}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {proofs.length > 0 ? `${proofs.length} proof${proofs.length !== 1 ? "s" : ""} submitted` : "No proofs submitted yet"}
                            </span>
                            <Button size="sm" variant="outline" onClick={() => setProofFormFor(m.id)} disabled={busy}>
                              + Add Proof
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {proofs.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {proofs.map((p) => (
                          <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/10 px-3 py-2 text-xs">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{p.description}</p>
                              <p className="mt-0.5 truncate text-muted-foreground">
                                <a
                                  href={p.proofHash.startsWith("http") ? p.proofHash : `https://ipfs.io/ipfs/${p.proofHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline underline-offset-2"
                                >
                                  {p.proofHash}
                                </a>
                                {" · "}{new Date(p.timestamp * 1000).toLocaleDateString()}
                              </p>
                            </div>
                            <span className="ml-2 shrink-0 text-muted-foreground">proof #{p.id}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Feedback Section ── */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>💬 Share Your Feedback</CardTitle>
          <CardDescription>Help us improve CrowdEscrow</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Rating</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`text-2xl transition-colors ${star <= feedbackRating ? "text-yellow-400" : "text-muted-foreground/30"} hover:text-yellow-400`}
                  onClick={() => setFeedbackRating(star)}
                >
                  {star <= feedbackRating ? "★" : "☆"}
                </button>
              ))}
            </div>
          </div>
          <Input
            placeholder="Tell us about your experience..."
            value={feedbackMessage}
            onChange={(e) => setFeedbackMessage(e.target.value)}
          />
          <Button
            onClick={submitFeedback}
            disabled={busy || feedbackRating === 0}
            variant="outline"
            className="w-full"
          >
            {busy ? "Sending..." : "Submit Feedback"}
          </Button>
          {feedbackSubmitted && (
            <p className="text-sm text-emerald-400 text-center">Thanks for your feedback! 🎉</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
