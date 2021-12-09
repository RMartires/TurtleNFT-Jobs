const hre = require("hardhat");
const { Promise } = require('bluebird');
const { createContract } = require('./utill/createContract');
const { pinJSON } = require('./utill/pinJSON');
const config = require('./utill/config.json');

async function processContract(data, job) {
    hre.config.networks.matic.url = config[data.contract.blockchain];
    console.log(config[data.contract.blockchain]);

    await createContract(data.filename, data.contract.contractName, data.contract.contractSymbol);
    await hre.run("compile");
    const NFT = await hre.ethers.getContractFactory(data.contract.contractName);
    const nft = await NFT.deploy();
    await nft.deployed();
    console.log("NFT deployed to:", nft.address);

    console.log("Creating metadata");
    let tokenId = 100;
    let tokensToMint = [];
    let ipfsArr = await Promise.map(data.contract.tokens, (token) => {
        return pinJSON({
            filename: token.title,
            data: {
                Title: token.title,
                Description: token.description,
                URL: `ipfs://${token.image}`
            }
        });
    }, { concurrency: 5 });
    data.contract.tokens.forEach((token, tdx) => {
        for (var i = 0; i < token.number; i++) {
            tokensToMint.push({
                URL: `ipfs://${ipfsArr[tdx]}`,
                tokenId: tokenId
            });
            tokenId += 1;
        }
    });

    console.log("starting to mint");
    let contract = NFT.attach(nft.address);
    let mintedTokens = await Promise.map(tokensToMint, (token, tdx) => {
        let progress = (tdx + 1) / tokensToMint.length;
        return mintToken(contract, { ...token, userWallet: data.userWallet }, job, progress);
    }, { concurrency: 1 });

    let deployedTokens = tokensToMint.map((token, tdx) => ({ ...token, ...mintedTokens[tdx] }));

    console.log("done minting");
    return { deployedTokens: deployedTokens, contractAddress: nft.address }
}

async function mintToken(contract, data, job, progress) {

    let tx = await contract.createNFT(data.userWallet, data.URL, data.tokenId);
    console.log("tx, nonce:", tx.nonce);
    console.log("tx, hash:", tx.hash);
    let txHash = tx.hash;
    let tokenID = await new Promise((res, rej) => {
        contract.on("ValueChanged", (author, newValue, event) => {
            res(parseInt(newValue._hex));
        });
    });
    job.progress(Math.round(progress * 100));

    return { txHash: txHash }
}

exports.processContract = processContract;