const fs = require('fs/promises');
const hre = require("hardhat");
const { Promise } = require('bluebird');
const { createContract } = require('./utill/createContract');
const config = require('./utill/config.json');

async function processContract(data, job) {
    hre.config.networks.matic.url = config[data.contract.blockchain];
    console.log(config[data.contract.blockchain]);

    await createContract(data.filename, data.contract.contractName, data.contract.contractSymbol);
    await hre.run("compile");
    job.log("Contract Compiled");
    const NFT = await hre.ethers.getContractFactory(data.contract.contractName);
    const nft = await NFT.deploy();
    await nft.deployed();
    console.log("NFT deployed to:", nft.address);
    job.log(`NFT deployed to: ${nft.address}`);

    await fs.unlink(`${__dirname}/../contracts/${data.filename}.sol`);

    console.log("Creating metadata");
    job.log("Creating metadata");
    const ExtraFields = ["external_url"];
    let tokenId = 1;
    let tokensToMint = [];
    let ipfsArr = data.contract.tokens.map(token => {
        let temp = {
            filename: token.title,
            data: {
                name: token.title,
                description: token.description,
                image: `ipfs://${token.image}`,
            }
        };

        ExtraFields.forEach(field => {
            if (token[field]) {
                temp.data[field] = token[field];
            }
        });

        return temp;
    });
    data.contract.tokens.forEach((token, tdx) => {
        for (var i = 0; i < token.number; i++) {
            tokensToMint.push({
                metaData: ipfsArr[tdx].data,
                filename: ipfsArr[tdx].filename,
                tokenId: tokenId
            });
            tokenId += 1;
        }
    });

    return { tokensToMint: tokensToMint, contractAddress: nft.address }
}

// async function mintToken(contract, data) {

//     let tx = await contract.createNFT(data.userWallet, data.URL, data.tokenId);
//     console.log("tx, nonce:", tx.nonce);
//     console.log("tx, hash:", tx.hash);
//     let txHash = tx.hash;
//     let tokenID = await new Promise((res, rej) => {
//         contract.on("ValueChanged", (author, newValue, event) => {
//             res(parseInt(newValue._hex));
//         });
//     });

//     return { txHash: txHash }
// }

exports.processContract = processContract;