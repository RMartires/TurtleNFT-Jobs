const ethers = require("ethers");

exports.mintNFT = async (data, adminPublicKey) => {
    let tokenID;
    const { abi } = require("./artifacts/contracts/NFT.sol/TophatTurtleCollectables.json");
    const rpcURL = "https://polygon-rpc.com";
    const provider = new ethers.providers.JsonRpcProvider({ url: rpcURL });

    const address = process.env.contractaddress; //contractAddress
    const URI = data.url

    const privateKey = process.env.privateKey; //privateKey of wallet

    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(address, abi, wallet);
    try {
        let tx = await contract.createNFT(adminPublicKey, URI);
        console.log("tx, nonce:", tx.nonce);
        console.log("tx, nonce:", tx.hash);
        tokenID = await new Promise((res, rej) => {
            contract.on("ValueChanged", (author, newValue, event) => {
                res(newValue);
            });
        });
    } catch (err) {
        console.log(err);
    }
    return parseInt(tokenID._hex);
};

exports.safeTransferFrom = async (from, to, id) => {
    const { abi } = require("./artifacts/contracts/NFT.sol/TophatTurtleCollectables.json");
    const rpcURL = "https://polygon-rpc.com";
    const provider = new ethers.providers.JsonRpcProvider({ url: rpcURL });

    const address = "0xCC91D95599197054F0E5b12646D0F2e61218597F"; //contractAddress

    const privateKey = process.env.privateKey;

    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(address, abi, wallet);

    try {
        let tx = await contract["safeTransferFrom(address,address,uint256)"](from, to, id);
        console.log(from, to, id);
        console.log("tx, nonce:", tx.hash);
        console.log("tx, nonce:", tx.nonce);
    } catch (err) {
        console.log(err);
        throw new Error(err.message);
    }
    return;

};

exports.ownerOf = async (id) => {
    const { abi } = require("./artifacts/contracts/NFT.sol/TophatTurtleCollectables.json");
    const rpcURL = "https://polygon-rpc.com";
    const provider = new ethers.providers.JsonRpcProvider({ url: rpcURL });

    const address = "0xCC91D95599197054F0E5b12646D0F2e61218597F"; //contractAddress

    const privateKey = process.env.privateKey;

    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(address, abi, wallet);

    try {
        let res = await contract.ownerOf(id);
        return res;
    } catch (err) {
        console.log(err);
    }
    return;

};