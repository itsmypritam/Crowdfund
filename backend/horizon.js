async function verifyDonation({ horizonUrl, campaignId, donor, txHash, timeoutMs = 8000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${horizonUrl}/transactions/${txHash}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { ok: false, reason: "transaction not found" };

    const tx = await res.json();
    if (tx.successful !== true) return { ok: false, reason: "transaction not successful" };
    if (tx.source_account && tx.source_account !== donor) {
      return { ok: false, reason: "source account mismatch" };
    }

    const opRes = await fetch(`${horizonUrl}/transactions/${txHash}/operations`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (opRes.ok) {
      const ops = await opRes.json();
      const records = ops._embedded && ops._embedded.records ? ops._embedded.records : [];
      const invoke = records.find((o) => o.type === "invoke_host_function");
      if (invoke && invoke.source_account && invoke.source_account !== donor) {
        return { ok: false, reason: "source account mismatch" };
      }
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: "verification service unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { verifyDonation };
