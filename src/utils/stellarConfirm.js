"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmTx = confirmTx;
const node_fetch_1 = __importDefault(require("node-fetch"));
const HORIZON = 'https://horizon.stellar.org';
async function confirmTx(txHash, tries = 20) {
    for (let i = 0; i < tries; i++) {
        const r = await (0, node_fetch_1.default)(`${HORIZON}/transactions/${txHash}`);
        if (r.status === 404) {
            // Transaction not found yet, wait and retry
            await new Promise(res => setTimeout(res, 2000));
            continue;
        }
        if (!r.ok)
            throw new Error(`RPC status ${r.status}`);
        const json = await r.json();
        if (json.successful !== undefined)
            return; // success!
        await new Promise(res => setTimeout(res, 2000));
    }
    throw new Error('Timeout waiting for tx confirmation');
}
