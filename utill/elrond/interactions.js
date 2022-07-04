const {
    Account,
    Address,
    AddressValue,
    ChainID,
    ContractFunction,
    GasLimit,
    I8Value,
    ProxyProvider,
    SmartContract,
    StringValue,
    AbiRegistry,
    SmartContractAbi,
    Egld,
    Balance,
    BigUIntValue,
    BytesValue,
    ArgSerializer,
    TransactionPayload,
    Transaction,
    TypedValue,
    TransactionWatcher, NetworkConfig, U64Value,
} = require("@elrondnetwork/erdjs/out");
let {
    GATEWAY_URL,
    PEM_PATH,
    EXPLORER_URL,
    ESDT_SC_ADDRESS,
    NFT_COLLECTION_NAME,
    NFT_COLLECTION_TICKER, CHAIN_ID, API_URL,
} = require("./config");

let {
    account,
    provider,
    signer,
} = require('./provider');
const BigNumber = require('bignumber.js');
const axios = require("axios");
const fs = require("fs");
const { UserSigner } = require("@elrondnetwork/erdjs-walletcore/out");
const { elrondTransfer } = require("./4-bulk-transfer");
const { elrondSetRoleForMinting } = require("./2-set-roles");
const ElrondTypes = {
    Mainet: 0,
    Testnet: 1
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function getLastNonce(nft_collection_id) {
    const urlFor = `${API_URL}/collections/${nft_collection_id}/nfts?size=1`
    console.log(urlFor)
    const { data } = await axios.get(urlFor);
    console.log(data + "getLastNonce");
    console.log(data.length)
    // collection does not have any NFTs
    if (data.length === 0) return 1
    return parseInt(data[0].nonce);
}
/** Deployes smart contract, which is used for minting NFTs later. Also issues the role, so after execution everything is ready for minting.
 * @param nftCollectionName
 * @param nftCollectionTicker
 * @param networkType
 * @returns collection identifier, which acts as smart contract address
 */
exports.elrondIssueCollectionAndSetRole = async (account, signer, provider, nftCollectionName, nftCollectionTicker, networkType) => {
    // will be refactored
    //configureElrondNetwork(ElrondTypes.Testnet)
    const args = [
        BytesValue.fromUTF8(nftCollectionName),
        BytesValue.fromUTF8(nftCollectionTicker),
        BytesValue.fromUTF8('canFreeze'), BytesValue.fromUTF8('true'),
        BytesValue.fromUTF8('canWipe'), BytesValue.fromUTF8('true'),
        BytesValue.fromUTF8('canPause'), BytesValue.fromUTF8('true'),
        BytesValue.fromUTF8('canTransferNFTCreateRole'), BytesValue.fromUTF8('true'),
        BytesValue.fromUTF8('canChangeOwner'), BytesValue.fromUTF8('true'),
        BytesValue.fromUTF8('canUpgrade'), BytesValue.fromUTF8('true'),
        BytesValue.fromUTF8('canAddSpecialRoles'), BytesValue.fromUTF8('true'),
    ];
    console.log(account + "accounttest")
    const { argumentsString } = new ArgSerializer().valuesToString(args);
    const data = new TransactionPayload(`issueNonFungible@${argumentsString}`);
    const gasLimit = GasLimit.forTransfer(data).add(new GasLimit(60000000));
    const nonceUrl = `${GATEWAY_URL}/address/${account.address}/nonce`
    const responseNonce = (await axios.get(nonceUrl)).data.data.nonce

    const tx = new Transaction({
        nonce: responseNonce,
        receiver: new Address(ESDT_SC_ADDRESS),
        data: data,
        value: Egld.raw(50000000000000000),
        gasLimit: gasLimit,
    });

    await signer.sign(tx);
    const txHash = await tx.send(provider);
    await tx.awaitExecuted(provider);
    // adding sleep just to be 100% sure
    await sleep(8000)
    console.log(`${tx.getSender()}`);
    console.log(`${EXPLORER_URL}${txHash.toString()}`);
    const urlForGettingCollectionIdentifier = `${GATEWAY_URL}/address/${tx.getSender()}/registered-nfts`
    const response = (await axios.get(urlForGettingCollectionIdentifier)).data
    const matches = response.data.tokens.filter(element => {
        if (element.indexOf(nftCollectionTicker) !== -1) {
            return true;
        }
    });
    // need to save this one
    await elrondSetRoleForMinting(account, signer, provider, matches[0])
    return { data: matches[0] };

}
/**
 *
 * @param nftCollectionId
 * @param receiverAddress user address in string
 * @returns executes and returns nothing.
 */
exports.mintAndTransfer = async (account, signer, provider, nftCollectionId, receiverAddress, ipfs, blockchain) => {
    const nftData = await elrondMintNft(account, signer, provider, nftCollectionId, ipfs)
    console.log(nftData.nonce + "afterminting")
    await elrondTransfer(account, signer, provider, receiverAddress, [{
        id: nftCollectionId,
        nonce: nftData.nonce,
    }],)
    console.log(nftData.nonce + "aftertransfer")
    return { ...nftData }
}

/**
 *
 * @param nftCollectionId
 * @returns {Promise<void>}
 */
async function elrondMintNft(account, signer, provider, nftCollectionId, ipfs) {
    // Pass collection id, query firestore document with that collectionId and from that get collection name, the image path.
    let nftCollectionName = "random"
    let imagePath = ipfs
    console.log(nftCollectionId + "used")
    const nonceForName = await getLastNonce(nftCollectionId);
    console.log(nonceForName)
    const name = "#" + " " + nonceForName + " " + nftCollectionName
    console.log(account)
    // IPFs image is required as well
    const args = [
        BytesValue.fromUTF8(nftCollectionId),
        new U64Value(1),
        BytesValue.fromUTF8(name),
        new U64Value(1000), // royalties
        BytesValue.fromUTF8(nftCollectionId),
        BytesValue.fromUTF8(`tags:${nftCollectionName},Combased`),
        BytesValue.fromUTF8(imagePath),
    ];
    const { argumentsString } = new ArgSerializer().valuesToString(args);
    const data = new TransactionPayload(`ESDTNFTCreate@${argumentsString}`);
    const gasLimit = GasLimit.forTransfer(data).add(new GasLimit(6000000));
    const nonceUrl = `${GATEWAY_URL}/address/${account.address}/nonce`;
    const responseNonce = (await axios.get(nonceUrl)).data.data.nonce;

    const tx = new Transaction({
        nonce: responseNonce,
        receiver: account.address,
        data: data,
        gasLimit: gasLimit,
    });

    await signer.sign(tx);
    const txHash = await tx.send(provider);
    await tx.awaitExecuted(provider);
    console.log(`${EXPLORER_URL}${txHash.toString()}`);

    const last_nonce = await getLastNonce(nftCollectionId);
    console.log('Last Nonce: ', last_nonce);
    return { tx: txHash.toString(), nonce: last_nonce };
}
