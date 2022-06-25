// const GATEWAY_URL = "https://devnet-gateway.elrond.com";
// const API_URL = "https://devnet-api.elrond.com";
// const EXPLORER_URL = 'https://devnet-explorer.elrond.com/transactions/';
// const CHAIN_ID = "D"
let GATEWAY_URL = "https://testnet-gateway.elrond.com";
const API_URL = "https://testnet-api.elrond.com";
const EXPLORER_URL = 'https://testnet-explorer.elrond.com/transactions/';
const CHAIN_ID = "T"

// const GATEWAY_URL = "https://gateway.elrond.com";
// const API_URL = "https://api.elrond.com";
// const EXPLORER_URL = 'https://explorer.elrond.com/transactions/';
// const CHAIN_ID = "1"

const PEM_PATH = "elrond-wallet.pem"

const MAX_GAS_PER_TRANSACTIONS = 600_000_000;
const DELAY_TIME = 2000;

const ESDT_SC_ADDRESS = 'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzllls8a5w6u';

const NFT_COLLECTION_NAME = 'SvenNFT';
const NFT_COLLECTION_TICKER = 'SVENNFT';
const NFT_COLLECTION_ID = 'SVENNFT-8ebca0';  //testnet
// const NFT_COLLECTION_ID = 'SVENNFT-b70d12';  //devnet

module.exports = {
    GATEWAY_URL,
    API_URL,
    EXPLORER_URL,
    CHAIN_ID,
    PEM_PATH,
    DELAY_TIME,
    ESDT_SC_ADDRESS,
    NFT_COLLECTION_NAME,
    NFT_COLLECTION_TICKER,
    NFT_COLLECTION_ID,
}
