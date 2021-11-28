const hre = require("hardhat");
const { createContract } = require('./utill/createContract');

async function processContract(data) {
    await createContract(data.filename, data.contractName, data.contractSymbol);
    await hre.run("compile");
    const NFT = await hre.ethers.getContractFactory(data.contractName);
    const nft = await NFT.deploy();
    await nft.deployed();
    console.log("NFT deployed to:", nft.address);
    return nft.address;
}

exports.processContract = processContract;