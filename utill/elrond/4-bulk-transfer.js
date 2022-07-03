const fs = require('fs');
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
	U64Value,
} = require("@elrondnetwork/erdjs/out");
const {
	GATEWAY_URL,
	PEM_PATH,
	EXPLORER_URL,
	ESDT_SC_ADDRESS,
	NFT_COLLECTION_NAME,
	NFT_COLLECTION_TICKER,
	NFT_COLLECTION_ID,
} = require("./config");

const {
	account,
	provider,
	signer,
} = require('./provider');
const BigNumber = require('bignumber.js');
exports.elrondTransfer = async (account, signer, provider,receiver,nfts) => {
	if (nfts.length == 0) return;

	const args = [
		new AddressValue(new Address(receiver)),
		new U64Value(nfts.length),
	];

	for (const nft of nfts) {
		args.push(BytesValue.fromUTF8(nft.id));
		args.push(new U64Value(nft.nonce));
		args.push(new U64Value(1));	// NFT quantity is always 1
	}

	const { argumentsString } = new ArgSerializer().valuesToString(args);
	const data = new TransactionPayload(`MultiESDTNFTTransfer@${argumentsString}`);
	const gasLimit = GasLimit.forTransfer(data).add(new GasLimit(6000000));

	const tx = new Transaction({
		nonce: account.getNonceThenIncrement(),
		receiver: account.address,
		data: data,
		gasLimit: gasLimit,
	});

	await signer.sign(tx);
	const txHash = await tx.send(provider);
	console.log(`${EXPLORER_URL}${txHash.toString()}`);
	return true
}
async function sendMultiNFT(receiver, nfts) {
	if (nfts.length == 0) return;

	const args = [
		new AddressValue(new Address(receiver)),
		new U64Value(nfts.length),
	];
	console.log("startedtrabsfer", nfts)

	for (const nft of nfts) {
		args.push(BytesValue.fromUTF8(nft.id));
		args.push(new U64Value(nft.nonce));
		args.push(new U64Value(1));	// NFT quantity is always 1
	}

	const { argumentsString } = new ArgSerializer().valuesToString(args);
	const data = new TransactionPayload(`MultiESDTNFTTransfer@${argumentsString}`);
	const gasLimit = GasLimit.forTransfer(data).add(new GasLimit(6000000));

	const tx = new Transaction({
		nonce: account.getNonceThenIncrement(),
		receiver: account.address,
		data: data,
		gasLimit: gasLimit,
	});

	await signer.sign(tx);
	const txHash = await tx.send(provider);
	console.log(`${EXPLORER_URL}${txHash.toString()}`);
}


(async function() {
	// await account.sync(provider);
	//
	// const receiver = 'erd15936k9pw34xyzmcaupyn7lpr7f6p20q50h4wlgemxg7h9zasdfysmhg50z'
	// const nfts = [
	// 	{
	// 		id: 'SVENNFT-9e1a70',
	// 		nonce: 2,
	// 	},
	// 	{
	// 		id: 'SVENNFT-9e1a70',
	// 		nonce: 3,
	// 	},
	// ]
	//
	// await sendMultiNFT(receiver, nfts);
})();
