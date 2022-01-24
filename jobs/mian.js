const fs = require('fs/promises');
const hre = require("hardhat");
const { Promise } = require('bluebird');
const { createContract } = require('./utill/createContract');
const config = require('./utill/config.json');

async function processContract(data, job) {
    hre.config.networks.matic.url = config[data.contract.blockchain];
    console.log(config[data.contract.blockchain]);

    await createContract(data.filename, data.contract.contractName,
        data.contract.contractSymbol, data.contract.tokens[0].number);
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
    let tokenToMint = null;
    let token = data.contract.tokens[0];
    let ipfs = null;
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

    if (token.attributes?.length > 0) {
        temp.data.attributes = token.attributes.map(x => {
            if (x.display_type) {
                let temp = {
                    display_type: x.display_type,
                    trait_type: x.trait_type,
                    value: Number(x.value.x) / Number(x.value.y)
                };
                return temp;
            } else {
                return x;
            }
        });
    }

    ipfs = temp;
    tokenToMint = {
        metaData: ipfs.data,
        filename: ipfs.filename.replace(" ", "_"),
    };

    return { tokenToMint: tokenToMint, contractAddress: nft.address }
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