const axios = require('axios');
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
	API_URL,
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


async function main() {
	const args = [
		BytesValue.fromUTF8(NFT_COLLECTION_ID),
		new U64Value(1),
		BytesValue.fromUTF8('SVEN NFT Name'),
		new U64Value(300), // royalties
		BytesValue.fromUTF8('Hash'),
		BytesValue.fromUTF8('Attributes'),
		BytesValue.fromUTF8('https://aero.mypinata.cloud/ipfs/QmapHXGPQ2mt3UhRaGUJbAjm3oe8iB4JDSKJsjrDwerQaR/1637875733.png'),
	];
	const { argumentsString } = new ArgSerializer().valuesToString(args);
	const data = new TransactionPayload(`ESDTNFTCreate@${argumentsString}`);
	const gasLimit = GasLimit.forTransfer(data).add(new GasLimit(6000000));
	const nonceUrl = `${GATEWAY_URL}/address/${account.address}/nonce`
	const responseNonce = (await axios.get(nonceUrl)).data.data.nonce
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

	const last_nonce = await getLastNonce(NFT_COLLECTION_ID);
	console.log('Last Nonce: ', last_nonce);
}


(async function() {
	//await account.sync(provider);
	// await main();
})();
