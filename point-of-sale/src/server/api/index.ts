import { PublicKey, Transaction } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { NextApiHandler } from 'next';
import { connection } from '../core';
import { cors, rateLimit } from '../middleware';
import {
    TOKEN_2022_PROGRAM_ID,
    createAssociatedTokenAccountInstruction,
    createTransferCheckedInstruction,
    getAssociatedTokenAddressSync,
    getMint,
} from '@solana/spl-token';

interface GetResponse {
    label: string;
    icon: string;
}

const get: NextApiHandler<GetResponse> = async (request, response) => {
    const label = request.query.label;
    if (!label) throw new Error('missing label');
    if (typeof label !== 'string') throw new Error('invalid label');

    const icon = 'https://www.paypalobjects.com/marketing/web23/us/en/quantum-leap/pyusd/hero_size-all.png';

    response.status(200).send({
        label,
        icon,
    });
};

interface PostResponse {
    transaction: string;
    message?: string;
}

const post: NextApiHandler<PostResponse> = async (request, response) => {
    /*
    Transfer request params provided in the URL by the app client. In practice, these should be generated on the server,
    persisted along with an unpredictable opaque ID representing the payment, and the ID be passed to the app client,
    which will include the ID in the transaction request URL. This prevents tampering with the transaction request.
    */
    const recipientField = request.query.recipient;
    if (!recipientField) throw new Error('missing recipient');
    if (typeof recipientField !== 'string') throw new Error('invalid recipient');
    const recipient = new PublicKey(recipientField);

    const amountField = request.query.amount;
    if (!amountField) throw new Error('missing amount');
    if (typeof amountField !== 'string') throw new Error('invalid amount');
    const amount = new BigNumber(amountField);

    const splTokenField = request.query['spl-token'];
    if (splTokenField && typeof splTokenField !== 'string') throw new Error('invalid spl-token');
    const splToken = splTokenField ? new PublicKey(splTokenField) : undefined;

    const referenceField = request.query.reference;
    if (!referenceField) throw new Error('missing reference');
    if (typeof referenceField !== 'string') throw new Error('invalid reference');
    const reference = new PublicKey(referenceField);

    const memoParam = request.query.memo;
    if (memoParam && typeof memoParam !== 'string') throw new Error('invalid memo');
    const memo = memoParam || undefined;

    const messageParam = request.query.message;
    if (messageParam && typeof messageParam !== 'string') throw new Error('invalid message');
    const message = messageParam || undefined;

    // Account provided in the transaction request body by the wallet.
    const accountField = request.body?.account;
    if (!accountField) throw new Error('missing account');
    if (typeof accountField !== 'string') throw new Error('invalid account');
    const sender = new PublicKey(accountField);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const transaction = new Transaction({
        feePayer: sender,
        blockhash: blockhash,
        lastValidBlockHeight: lastValidBlockHeight,
    });

    const mint = await getMint(connection, splToken!, 'confirmed', TOKEN_2022_PROGRAM_ID);

    const senderTokenAccountAddress = getAssociatedTokenAddressSync(mint.address, sender, false, TOKEN_2022_PROGRAM_ID);
    const recipientTokenAccountAddress = getAssociatedTokenAddressSync(
        mint.address,
        recipient,
        false,
        TOKEN_2022_PROGRAM_ID
    );

    // Check if recipient token account exists. If not, add instruction to create it.
    let recipientTokenAccount = await connection.getAccountInfo(recipientTokenAccountAddress);
    if (recipientTokenAccount == null) {
        const createTokenAccountInstruction = createAssociatedTokenAccountInstruction(
            sender, // payer
            recipientTokenAccountAddress,
            recipient,
            mint.address,
            TOKEN_2022_PROGRAM_ID
        );
        transaction.add(createTokenAccountInstruction);
    }

    const instruction = createTransferCheckedInstruction(
        senderTokenAccountAddress,
        mint.address,
        recipientTokenAccountAddress,
        sender,
        amount.toNumber() * 10 ** mint.decimals,
        mint.decimals,
        [],
        TOKEN_2022_PROGRAM_ID
    );
    instruction.keys.push({ pubkey: reference, isSigner: false, isWritable: false });
    transaction.add(instruction);

    // Serialize and return the unsigned transaction.
    const serialized = transaction.serialize({
        verifySignatures: false,
        requireAllSignatures: false,
    });
    const base64 = serialized.toString('base64');

    response.status(200).send({ transaction: base64, message });
};

const index: NextApiHandler<GetResponse | PostResponse> = async (request, response) => {
    await cors(request, response);
    await rateLimit(request, response);

    if (request.method === 'GET') return get(request, response);
    if (request.method === 'POST') return post(request, response);

    throw new Error(`Unexpected method ${request.method}`);
};

export default index;
