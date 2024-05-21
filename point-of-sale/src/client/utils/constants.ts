import { clusterApiUrl, PublicKey } from '@solana/web3.js';

export const MAX_CONFIRMATIONS = 32;

export const NON_BREAKING_SPACE = '\u00a0';

export const DEVNET_ENDPOINT = process.env.NEXT_PUBLIC_DEVNET_RPC || clusterApiUrl('devnet');

export const MAINNET_ENDPOINT = process.env.NEXT_PUBLIC_MAINNET_RPC || clusterApiUrl('mainnet-beta');

export const MAINNET_PYUSD_MINT = new PublicKey('2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo');
