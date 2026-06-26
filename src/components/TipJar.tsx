import { useState, useEffect, useCallback } from "react";
import {
  isConnected,
  getAddress,
  signTransaction,
} from "@stellar/freighter-api";
import {
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Asset,
  Operation,
  Memo,
  Account,
} from "@stellar/stellar-sdk";
import { QRCodeSVG } from "qrcode.react";

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

const TIP_JAR = "GATJMD6BGNK4FQYNFWB354N7RP4XHA2R74GNSYM472ALNLJFX7NXBS3X";
const HORIZON = "https://horizon-testnet.stellar.org";
const NET = Networks.TESTNET;

interface TxStatus {
  hash: string;
  status: "success" | "error";
  message: string;
}

export default function TipJar() {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<TxStatus | null>(null);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  const fetchBalance = useCallback(async (addr: string) => {
    try {
      const res = await fetch(`${HORIZON}/accounts/${addr}`);
      if (!res.ok) throw new Error("Account not found on testnet");
      const data = await res.json();
      const b = data.balances?.find((x: any) => x.asset_type === "native");
      setBalance(b?.balance ?? "0");
    } catch {
      setBalance("0");
    }
  }, []);

  const check = useCallback(async () => {
    try {
      const c = await isConnected();
      if (c.error) return;
      const a = await getAddress();
      if (a.error) return;
      setAddress(a.address);
      fetchBalance(a.address);
    } catch {
      /* not connected */
    }
  }, [fetchBalance]);

  useEffect(() => { check(); }, [check]);

  useEffect(() => {
    if (address) fetchBalance(address);
  }, [address, fetchBalance]);

  const connect = async () => {
    try {
      const a = await getAddress();
      if (a.error) {
        alert("Please install Freighter and grant access.");
        return;
      }
      setAddress(a.address);
      await fetchBalance(a.address);
    } catch {
      alert("Failed to connect. Install Freighter wallet.");
    }
  };

  const disconnect = () => {
    setAddress(null);
    setBalance(null);
    setTx(null);
    setAmount("");
    setMemo("");
  };

  const short = (s: string) => `${s.slice(0, 4)}...${s.slice(-4)}`;

  const sendTip = async () => {
    if (!address || !amount || parseFloat(amount) <= 0) return;
    setBusy(true);
    setTx(null);

    try {
      const acctRes = await fetch(`${HORIZON}/accounts/${address}`);
      if (!acctRes.ok)
        throw new Error("Cannot fetch account details. Fund your wallet first.");
      const acctData = await acctRes.json();

      const source = new Account(address, acctData.sequence);

      const txb = new TransactionBuilder(source, {
        fee: BASE_FEE,
        networkPassphrase: NET,
      })
        .addOperation(
          Operation.payment({
            destination: TIP_JAR,
            asset: Asset.native(),
            amount,
          })
        )
        .setTimeout(30);

      if (memo.trim()) {
        txb.addMemo(Memo.text(memo.trim()));
      }

      const built = txb.build();
      const xdr = built.toXDR();

      const signed = await signTransaction(xdr, { networkPassphrase: NET });

      if (signed.error || !signed.signedTxXdr) {
        throw new Error(signed.error?.message || "Transaction signing was cancelled");
      }

      const submitRes = await fetch(`${HORIZON}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ tx: signed.signedTxXdr }),
      });

      const submitData = await submitRes.json();

      if (submitData.hash) {
        setTx({
          hash: submitData.hash,
          status: "success",
          message: `Sent ${amount} XLM to the Tip Jar!`,
        });
        await fetchBalance(address);
      } else {
        const errMsg =
          submitData.extras?.result_codes?.transaction ||
          submitData.title ||
          "Transaction failed";
        setTx({ hash: "", status: "error", message: `Failed: ${errMsg}` });
      }
    } catch (err: any) {
      setTx({
        hash: "",
        status: "error",
        message: err?.message || "Something went wrong",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="tip-jar" className="scroll-mt-20 mx-auto max-w-2xl px-4 py-16 md:py-24">
      <div className="text-center mb-8">
        <Badge variant="outline" className="mb-3">
          Stellar Testnet
        </Badge>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Send a Tip
        </h2>
        <p className="mt-2 text-muted-foreground max-w-md mx-auto">
          Support my work with a Stellar XLM donation.
        </p>
      </div>

      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>☕ Tip Jar</CardTitle>
              <CardDescription>
                {address
                  ? `Connected as ${short(address)}`
                  : "Connect your Freighter wallet to send a tip"}
              </CardDescription>
            </div>
            <QRCodeSVG value={TIP_JAR} size={72} />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {!address ? (
            <Button className="w-full" onClick={connect}>
              Connect Freighter Wallet
            </Button>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Balance</span>
                <span className="font-medium">
                  {balance !== null
                    ? `${parseFloat(balance).toFixed(4)} XLM`
                    : "Loading..."}
                </span>
              </div>

              <Input
                type="number"
                placeholder="Amount (XLM)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.0001"
                disabled={busy}
              />
              <Input
                type="text"
                placeholder="Memo (optional)"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                maxLength={28}
                disabled={busy}
              />

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={sendTip}
                  disabled={busy || !amount || parseFloat(amount) <= 0}
                >
                  {busy ? "Sending..." : "Send Tip"}
                </Button>
                <Button variant="ghost" onClick={disconnect}>
                  Disconnect
                </Button>
              </div>
            </>
          )}

          {tx && (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                tx.status === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400"
              }`}
            >
              <p className="flex items-center gap-1.5">
                <span>{tx.status === "success" ? "✅" : "❌"}</span>
                {tx.message}
              </p>
              {tx.hash && (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-xs underline underline-offset-2 hover:no-underline"
                >
                  View on Stellar Expert →
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
