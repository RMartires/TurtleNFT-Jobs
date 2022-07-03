

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
	BytesValue,
	BigUIntValue,
	Egld,
	U32Value,
	NetworkConfig,
	TypedValue,
	ArgSerializer,
	TransactionPayload,
	Transaction,
	Interaction,
	DefaultSmartContractController,
} = require("@elrondnetwork/erdjs/out");
const { UserSecretKey, UserSigner } = require("@elrondnetwork/erdjs-walletcore");
const {
	GATEWAY_URL,
	PEM_PATH,
	EXPLORER_URL,
	CHAIN_ID,
} = require("./config");
const {elrondIssueCollectionAndSetRole, mintAndTransfer} = require("./interactions");

let provider = new ProxyProvider(GATEWAY_URL, { timeout: 20000 });
let config = NetworkConfig.getDefault();
config.ChainID = new ChainID(CHAIN_ID);
config.sync(provider);

const pem = fs.readFileSync(PEM_PATH, { encoding: 'utf-8' }).trim();
let signer = UserSigner.fromPem(pem);
let account = new Account(new Address((signer.getAddress()).bech32()));
console.log(account);
// const getSigner(type) {
// 	if (env == 'devnet') return devnetSigner;
// 	else return mainnetSigner;
// }
module.exports = {
	provider,
	signer,
	account,
}

