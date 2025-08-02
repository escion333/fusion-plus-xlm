import fetch from 'node-fetch';

const HORIZON = 'https://horizon.stellar.org';

export async function confirmTx(txHash: string, tries = 20): Promise<void> {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(`${HORIZON}/transactions/${txHash}`);
    if (r.status === 404) {
      // Transaction not found yet, wait and retry
      await new Promise(res => setTimeout(res, 2_000));
      continue;
    }
    if (!r.ok) throw new Error(`RPC status ${r.status}`);
    const json = await r.json();
    if (json.successful !== undefined) return;     // success!
    await new Promise(res => setTimeout(res, 2_000));
  }
  throw new Error('Timeout waiting for tx confirmation');
}