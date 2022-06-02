const fs = require('fs/promises');
const hre = require("hardhat");
const { Promise } = require('bluebird');
const { createContract } = require('./utill/createContract');
const config = require('./utill/config.json');
const axios = require('axios');
const { ethers } = require("ethers");

const gasStation = {
    "polygonMainnet": 'https://gasstation-mainnet.matic.network/',
    "polygonTestnet": 'https://gasstation-mumbai.matic.today/'
};

async function processContract(data, job) {
    job.log(data.contract.blockchain);

    let r1 = await axios.get(gasStation[data.contract.blockchain]);
    let gasPrice = r1.data['fast'] * 1000000000;
    gasPrice = Math.round(gasPrice);


    await createContract(data.filename, data.contract.contractName,
        data.contract.contractSymbol, data.contract.tokens[0].number, ["genArtContract", "multi-asset"].indexOf(data.contract?.type) > -1);
    await hre.run("compile");
    job.log("Contract Compiled");

    let r = await fs.readFile(`${__dirname}/../artifacts/contracts/${data.filename}.sol/${data.contract.contractName}.json`);
    r = JSON.parse(r.toString());

    let provider = new ethers.providers.JsonRpcProvider(config[data.contract.blockchain]);
    let nonce = await provider.getTransactionCount(process.env.Public_KEY);

    let wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    let NFT = new ethers.ContractFactory(r.abi, r.bytecode, wallet);

    // let deployedData = NFT.interface.encodeDeploy();
    // let estimateGas = await provider.estimateGas({ data: deployedData });
    // console.log(estimateGas);

    let nft = await NFT.deploy({
        gasPrice: ethers.BigNumber.from(gasPrice),
        // gasLimit: estimateGas,
        nonce: nonce
    });
    job.log(nft.deployTransaction.hash);
    job.log(nft.deployTransaction.nonce);
    console.log(nft.deployTransaction.hash, nft.deployTransaction.nonce);
    await nft.deployTransaction.wait();
    console.log(nft.address);
    job.log(nft.address);

    await fs.unlink(`${__dirname}/../contracts/${data.filename}.sol`);

    console.log("Creating metadata");
    job.log("Creating metadata");
    const ExtraFields = ["external_link"];
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
            temp.data["external_url"] = token[field];
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

    let IdsToMint = null;
    if (data.contract?.type == "genArtContract")
        IdsToMint = Array.from({ length: data.contract.tokens[0].number }, (v, i) => i + 1);

    let tokensToMint = null;
    if (data.contract?.type == "multi-asset") {
        tokensToMint = [];
        tokenId = 1;
        data.contract.tokens.forEach(token => {
            let temp = {
                filename: token.title,
                data: {
                    name: token.title,
                    description: token.description,
                    image: `ipfs://${token.image}`,
                }
            };
            let tokens = Array.from({ length: token.number }).map((x, xdx) => {
                let finalToken = { ...temp, Id: tokenId };
                tokenId = tokenId + 1;
                return finalToken;
            });
            tokensToMint.push(...tokens);
        });
    }


    return { tokenToMint: tokenToMint, contractAddress: nft.address, IdsToMint, tokensToMint }
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