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
const axios = require("axios");
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
exports.elrondSetRoleForMinting= async (account, signer, provider, nftCollectionId) => {
	const args = [
		BytesValue.fromUTF8(nftCollectionId),
		new AddressValue(account.address),
		BytesValue.fromUTF8('ESDTRoleNFTCreate'),
		BytesValue.fromUTF8('ESDTRoleNFTBurn'),
		BytesValue.fromUTF8('ESDTRoleNFTUpdateAttributes'),
		BytesValue.fromUTF8('ESDTRoleNFTAddURI'),
	];
	const { argumentsString } = new ArgSerializer().valuesToString(args);
	const data = new TransactionPayload(`setSpecialRole@${argumentsString}`);
	const gasLimit = GasLimit.forTransfer(data).add(new GasLimit(60000000));
	const nonceUrl = `${GATEWAY_URL}/address/${account.address}/nonce`
	const responseNonce = (await axios.get(nonceUrl)).data.data.nonce
	const tx = new Transaction({
		nonce: responseNonce,
		receiver: new Address(ESDT_SC_ADDRESS),
		data: data,
		gasLimit: gasLimit,
	});

	await signer.sign(tx);
	const txHash = await tx.send(provider);
	await tx.awaitExecuted(provider);
	console.log("role for minting is set")
	console.log(`${EXPLORER_URL}${txHash.toString()}`);
	// adding sleep just to be 100% sure
	await sleep(5000)
}
async function main() {
	const args = [
		BytesValue.fromUTF8(NFT_COLLECTION_ID),
		new AddressValue(account.address),
		BytesValue.fromUTF8('ESDTRoleNFTCreate'),
		BytesValue.fromUTF8('ESDTRoleNFTBurn'),
		BytesValue.fromUTF8('ESDTRoleNFTUpdateAttributes'),
		BytesValue.fromUTF8('ESDTRoleNFTAddURI'),
	];
	const { argumentsString } = new ArgSerializer().valuesToString(args);
	const data = new TransactionPayload(`setSpecialRole@${argumentsString}`);
	const gasLimit = GasLimit.forTransfer(data).add(new GasLimit(60000000));

	const tx = new Transaction({
		nonce: account.getNonceThenIncrement(),
		receiver: new Address(ESDT_SC_ADDRESS),
		data: data,
		gasLimit: gasLimit,
	});

	await signer.sign(tx);
	const txHash = await tx.send(provider);
	await tx.awaitExecuted(provider);
	console.log(`${EXPLORER_URL}${txHash.toString()}`);
}

async function unset() {
	const args = [
		BytesValue.fromUTF8(NFT_COLLECTION_ID),
		new AddressValue(account.address),
		BytesValue.fromUTF8('ESDTTransferRole'),
	];
	const { argumentsString } = new ArgSerializer().valuesToString(args);
	const data = new TransactionPayload(`unSetSpecialRole@${argumentsString}`);
	const gasLimit = GasLimit.forTransfer(data).add(new GasLimit(60000000));

	const tx = new Transaction({
		nonce: account.getNonceThenIncrement(),
		receiver: new Address(ESDT_SC_ADDRESS),
		data: data,
		gasLimit: gasLimit,
	});

	await signer.sign(tx);
	const txHash = await tx.send(provider);
	console.log(`${EXPLORER_URL}${txHash.toString()}`);
}


(async function() {
	// await account.sync(provider);
	// await main();
	// await unset();
})();
