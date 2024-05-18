import { Myth } from './Myth';
import {
    Field,
    Mina,
    PrivateKey,
    PublicKey,
    AccountUpdate,
    Signature, NetworkId,
} from 'o1js';
import { Client } from "mina-signer";

const client = new Client({
    network: process.env.NETWORK_KIND as NetworkId ?? 'testnet'
});

let proofsEnabled = false;
const MYTH_PUBLIC_KEY = 'B62qoAE4rBRuTgC42vqvEyUqCGhaZsW58SKVW4Ht8aYqP9UTvxFWBgy';
let privateKey = process.env.PRIVATE_KEY ?? 'EKF65JKw9Q1XWLDZyZNGysBbYG21QbJf3a4xnEoZPZ28LKYGMw53';

describe('OracleExample', () => {
    let deployerAccount: Mina.TestPublicKey,
        deployerKey: PrivateKey,
        senderAccount: Mina.TestPublicKey,
        senderKey: PrivateKey,
        zkAppAddress: PublicKey,
        zkAppPrivateKey: PrivateKey,
        zkApp: Myth;

    beforeAll(async () => {
        if (proofsEnabled) await Myth.compile();
    });

    beforeEach(async () => {
        const Local = await Mina.LocalBlockchain({ proofsEnabled });
        Mina.setActiveInstance(Local);
        deployerAccount = Local.testAccounts[0];
        deployerKey = deployerAccount.key;
        senderAccount = Local.testAccounts[1];
        senderKey = senderAccount.key;
        zkAppPrivateKey = PrivateKey.random();
        zkAppAddress = zkAppPrivateKey.toPublicKey();
        zkApp = new Myth(zkAppAddress);
    });

    async function localDeploy() {
        const txn = await Mina.transaction(deployerAccount, async () => {
            AccountUpdate.fundNewAccount(deployerAccount);
            await zkApp.deploy();
        });
        await txn.prove();
        await txn.sign([deployerKey, zkAppPrivateKey]).send();
    }

    it('generates and deploys the `Myth` smart contract', async () => {
        await localDeploy();
        const oraclePublicKey = zkApp.mythPublicKey.get();
        expect(oraclePublicKey).toEqual(PublicKey.fromBase58(MYTH_PUBLIC_KEY));
    });

    describe('hardcoded values', () => {
        it('emits an `price` event containing the price from pyth feed if provided signature is valid', async () => {
            await localDeploy();

            // 60 seconds
            const maxAge = Field(60);
            // feed id - BTC/USD
            const feed = Field(BigInt("0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43").toString());
            const feedPrice = Field(787);
            const {signature} = client.signFields(
                [
                    // Since feed is in hex format, we can BigInt it.
                    BigInt("0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"),
                    BigInt(60),
                    BigInt(787)
                ],
                privateKey
            );

            const txn = await Mina.transaction(senderAccount, async () => {
                await zkApp.verify(
                    feedPrice,
                    maxAge,
                    feed,
                    Signature.fromBase58(signature)
                );
            });
            await txn.prove();
            await txn.sign([senderKey]).send();

            const events = await zkApp.fetchEvents();
            const verifiedEventValue = events[0].event.data.toFields(null)[0];
            expect(verifiedEventValue).toEqual(feedPrice);
        });

        it('throws an error if the provided signature is invalid', async () => {
            await localDeploy();

            // 60 seconds
            const maxAge = Field(60);
            // feed id - BTC/USD
            const feed = Field(BigInt("0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43").toString());
            const feedPrice = Field(787);
            const signature = Signature.fromBase58(
                '7mXPv97hRN7AiUxBjuHgeWjzoSgL3z61a5QZacVgd1PEGain6FmyxQ8pbAYd5oycwLcAbqJLdezY7PRAUVtokFaQP8AJDEGX'
            );

            expect(async () => {
                await Mina.transaction(senderAccount, async () => {
                    await zkApp.verify(
                        feedPrice,
                        maxAge,
                        feed,
                        signature
                    );
                });
            }).rejects;
        });
    });

    describe('actual API requests', () => {
        it('emits an `id` event containing the users id if their credit score is above 700 and the provided signature is valid', async () => {
            await localDeploy();

            const response = await fetch(
                'https://07-oracles.vercel.app/api/credit-score?user=1'
            );
            const data = await response.json();

            const id = Field(data.data.id);
            const creditScore = Field(data.data.creditScore);
            const signature = Signature.fromBase58(data.signature);

            const txn = await Mina.transaction(senderAccount, async () => {
                await zkApp.verify(id, creditScore, signature);
            });
            await txn.prove();
            await txn.sign([senderKey]).send();

            const events = await zkApp.fetchEvents();
            const verifiedEventValue = events[0].event.data.toFields(null)[0];
            expect(verifiedEventValue).toEqual(id);
        });

        it('throws an error if the credit score is below 700 even if the provided signature is valid', async () => {
            await localDeploy();

            const response = await fetch(
                'https://07-oracles.vercel.app/api/credit-score?user=2'
            );
            const data = await response.json();

            const id = Field(data.data.id);
            const creditScore = Field(data.data.creditScore);
            const signature = Signature.fromBase58(data.signature);

            expect(async () => {
                const txn = await Mina.transaction(senderAccount, async () => {
                    await zkApp.verify(id, creditScore, signature);
                });
            }).rejects;
        });
    });
});
