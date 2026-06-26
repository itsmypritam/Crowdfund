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
} from "@stellar/stellar-sdk";
import { QRCodeSVG } from "qrcode.react";

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

  const connect = async () => {
    try {
      const a = await getAddress();
      if (a.error) { alert("Please install Freighter and grant access."); return; }
      setAddress(a.address);
      fetchBalance(a.address);
    } catch {
      alert("Failed to connect. Install Freighter wallet.");
    }
  };

  const disconnect = () => {
    setAddress(null);
    setBalance(null);
    setTx(null);
  };

  const short = (s: string) => `${s.slice(0, 4)}...${s.slice(-4)}`;

  const sendTip = async () => {
    if (!address || !amount || parseFloat(amount) <= 0) return;
    setBusy(true);
    setTx(null);

    try {
      const acctRes = await fetch(`${HORIZON}/accounts/${address}`);
      const acctData = await acctRes.json();
      const seq = acctData.sequence;

      const tx = new TransactionBuilder(
        { accountId: () => address, sequenceNumber: () => seq },
        { fee: BASE_FEE, networkPassphrase: NET },
      )
        .addOperation(Operation.payment({
          destination: TIP_JAR,
          asset: Asset.native(),
          amount,
        }))
        .setTimeout(30);

      if (memo.trim()) {
        tx.addMemo(Memo.text(memo.trim()));
      }

      const built = tx.build();
      const xdr = built.toXDR();

      const signed = await signTransaction(xdr, {
        networkPassphrase: NET,
      });

      if (signed.error || !signed.signedTxXdr) {
        throw new Error(signed.error?.message || "Signing cancelled");
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
        setTx({
          hash: "",
          status: "error",
          message: submitData.extras?.result_codes?.transaction
            ? `Failed: ${submitData.extras.result_codes.transaction}`
            : "Transaction failed",
        });
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
    <div className="tipjar-container">
      <div className="tipjar-card">
        <div className="tipjar-header">
          <h1>☕ Tip Jar</h1>
          <p>Send XLM to support my work on Stellar testnet</p>
        </div>

        <div className="qr-section">
          <QRCodeSVG value={TIP_JAR} size={160} />
          <span className="qr-label">{short(TIP_JAR)}</span>
        </div>

        {!address ? (
          <button className="btn btn-primary" onClick={connect}>
            Connect Freighter Wallet
          </button>
        ) : (
          <div className="wallet-section">
            <div className="wallet-info">
              <span className="label">Connected</span>
              <span className="address">{short(address)}</span>
              <span className="balance">
                Balance: <strong>{balance !== null ? `${parseFloat(balance).toFixed(2)} XLM` : "Loading..."}</strong>
              </span>
            </div>

            <div className="tip-form">
              <input
                type="number"
                placeholder="Amount (XLM)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0" step="0.01"
                disabled={busy}
              />
              <input
                type="text"
                placeholder="Memo (optional)"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                maxLength={28}
                disabled={busy}
              />
              <button
                className="btn btn-primary"
                onClick={sendTip}
                disabled={busy || !amount || parseFloat(amount) <= 0}
              >
                {busy ? "Sending..." : "Send Tip"}
              </button>
            </div>

            <button className="btn btn-secondary" onClick={disconnect}>
              Disconnect
            </button>
          </div>
        )}

        {tx && (
          <div className={`tx-status ${tx.status}`}>
            <p>{tx.status === "success" ? "✅" : "❌"} {tx.message}</p>
            {tx.hash && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`}
                target="_blank" rel="noopener noreferrer"
              >
                View on Stellar Expert →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
