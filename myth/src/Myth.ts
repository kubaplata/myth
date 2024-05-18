import {
    Field,
    SmartContract,
    state,
    State,
    method,
    PublicKey,
    Signature,
} from 'o1js';

const MYTH_PUBLIC_KEY = 'B62qjUYdttVRLHGc1tiPhV6jtoH4NxvuBuL4zsQV1te8Pq4efP2EyD1';

export class Myth extends SmartContract {
    @state(PublicKey) mythPublicKey = State<PublicKey>();

    events = {
        price: Field,
    };

    init() {
        super.init();
        this.mythPublicKey.set(PublicKey.fromBase58(MYTH_PUBLIC_KEY));
        this.requireSignature();
    }

    @method async verify(
        feedPrice: Field,
        maxAge: Field,
        feed: Field,
        signature: Signature
    ) {
        const mythPublicKey = this.mythPublicKey.get();
        this.mythPublicKey.requireEquals(mythPublicKey);

        const validSignature = signature.verify(mythPublicKey, [
            feed,
            maxAge,
            feedPrice
        ]);

        validSignature.assertTrue();
        this.emitEvent('price', feedPrice);
    }
}