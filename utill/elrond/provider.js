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
const {UserSecretKey, UserSigner} = require("@elrondnetwork/erdjs-walletcore");
const {
    GATEWAY_URL,
    PEM_PATH,
    EXPLORER_URL,
    CHAIN_ID, GATEWAY_URL_MAINNET, GATEWAY_URL_TESTNET, API_URL, API_URL_MAINNET, API_URL_TESTNET, CHAIN_ID_TESTNET,
    CHAIN_ID_MAINNET,
} = require("./config");
const {elrondIssueCollectionAndSetRole, mintAndTransfer} = require("./interactions");
const {ElrondTypes} = require("../contractQueue");

let provider = new ProxyProvider(GATEWAY_URL, {timeout: 20000});
let config = NetworkConfig.getDefault();
config.ChainID = new ChainID(CHAIN_ID);
config.sync(provider);

function getGatewayUrl(type) {
    switch (type) {
        case ElrondTypes.elrondTestnet:
            return GATEWAY_URL_TESTNET
        case ElrondTypes.elrondMainet:
            return GATEWAY_URL_MAINNET
    }
}

function getAPIUrlPath(type){
    switch (type) {
        case ElrondTypes.elrondTestnet:
            return API_URL_TESTNET
        case ElrondTypes.elrondMainet:
            return API_URL_MAINNET
    }
}

function getChainId(type){
    switch (type) {
        case ElrondTypes.elrondTestnet:
            return CHAIN_ID_TESTNET
        case ElrondTypes.elrondMainet:
            return CHAIN_ID_MAINNET
    }
}

function getProvider(type) {
    let provider = new ProxyProvider(getGatewayUrl(type), {timeout: 20000});
    let config = NetworkConfig.getDefault();
    config.ChainID = new ChainID(getChainId(type));
    config.sync(provider);
    return provider
}

const pem = fs.readFileSync(PEM_PATH, {encoding: 'utf-8'}).trim();
let signer = UserSigner.fromPem(pem);
let account = new Account(new Address((signer.getAddress()).bech32()));
console.log(account);
// const getSigner(type) {
// 	if (env == 'devnet') return devnetSigner;
// 	else return mainnetSigner;
// }
// let provider = getProvider("elrondTestnet")
// print(provider)
module.exports = {
    provider,
    signer,
    account,
    getProvider,
	getGatewayUrl,
    getAPIUrlPath,
    getChainId
}

