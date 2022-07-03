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
	TransactionWatcher, NetworkConfig,
} =  require("@elrondnetwork/erdjs/out");
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
const {UserSigner} = require("@elrondnetwork/erdjs-walletcore/out");
const {elrondMintNft} = require("./3-mint");
const {elrondTransfer} = require("./4-bulk-transfer");
const {elrondSetRoleForMinting} = require("./2-set-roles");
const {mintAndTransfer, elrondIssueCollectionAndSetRole} = require("./interactions");
const ElrondTypes = {
	Mainet: 0,
	Testnet: 1
}
function configureElrondNetwork(type){
	let GATEWAY_URL = (type === ElrondTypes.Mainet) ? "gateway.elrond.com" : "https://testnet-gateway.elrond.com"
	provider = new ProxyProvider(GATEWAY_URL, { timeout: 20000 });
	let config = NetworkConfig.getDefault();
	config.ChainID = new ChainID(CHAIN_ID);
	config.sync(provider);
	let pemPath = (type === ElrondTypes.Mainet) ? "elrond-wallet.pem" : "elrond-wallet.pem"
	const pem = fs.readFileSync(pemPath, { encoding: 'utf-8' }).trim();
	signer = UserSigner.fromPem(pem);
	account = new Account(new Address((signer.getAddress()).bech32()));
}


async function main() {
	const args = [
		BytesValue.fromUTF8(NFT_COLLECTION_NAME),
		BytesValue.fromUTF8(NFT_COLLECTION_TICKER),
		BytesValue.fromUTF8('canFreeze'), BytesValue.fromUTF8('true'),
		BytesValue.fromUTF8('canWipe'), BytesValue.fromUTF8('true'),
		BytesValue.fromUTF8('canPause'), BytesValue.fromUTF8('true'),
		BytesValue.fromUTF8('canTransferNFTCreateRole'), BytesValue.fromUTF8('true'),
		BytesValue.fromUTF8('canChangeOwner'), BytesValue.fromUTF8('true'),
		BytesValue.fromUTF8('canUpgrade'), BytesValue.fromUTF8('true'),
		BytesValue.fromUTF8('canAddSpecialRoles'), BytesValue.fromUTF8('true'),
	];
	const { argumentsString } = new ArgSerializer().valuesToString(args);
	const data = new TransactionPayload(`issueNonFungible@${argumentsString}`);
	const gasLimit = GasLimit.forTransfer(data).add(new GasLimit(60000000));

	const tx = new Transaction({
		nonce: account.getNonceThenIncrement(),
		receiver: new Address(ESDT_SC_ADDRESS),
		data: data,
		value: Egld.raw(50000000000000000),
		gasLimit: gasLimit,
	});

	await signer.sign(tx);
	const txHash = await tx.send(provider);

	await tx.awaitExecuted(provider);
	// adding sleep just to be 100% sure
	await sleep(5000)
	console.log(`${tx.getSender()}`);
	const urlForGettingCollectionIdentifier = `${GATEWAY_URL}/address/${tx.getSender()}/registered-nfts`
	const response = (await axios.get(urlForGettingCollectionIdentifier)).data
	const matches = response.data.tokens.filter(element => {
		if (element.indexOf(NFT_COLLECTION_TICKER) !== -1) {
			return true;
		}
	});
	console.log(matches[0])
	console.log(`${EXPLORER_URL}${txHash.toString()}`);
}

(async function() {
	// configureElrondNetwork(1)
	await account.sync(provider);
	console.log(account)
	// await main();
	// Should be saved with collection ID
	// User just uploads image, and we get ipfsPath
	const dataForCollection = {
		ipfsPath:"pinata",
		collectionName:"test",
		collectionTicker:"TEST",
		networkType:ElrondTypes.Testnet
	}
	const collectionId = await elrondIssueCollectionAndSetRole(account, signer, provider, dataForCollection.collectionName, dataForCollection.collectionTicker, ElrondTypes.Testnet)
	console.log(collectionId.data)

	//store this collection id, pinata image, since it will be needed with minting, receiver is got from the client frontend (claiming page)

	//collection id is in the react app, possibly in the URL params, collectionName is received from the firebase
	const dataForClaiming ={
		receiver:'erd15936k9pw34xyzmcaupyn7lpr7f6p20q50h4wlgemxg7h9zasdfysmhg50z',
		collectionId:collectionId.data,
		collectionName:dataForCollection.collectionName
	}
	await mintAndTransfer(account, signer, provider, dataForClaiming.collectionId, dataForClaiming.receiver)
	console.log("completed")
})();
