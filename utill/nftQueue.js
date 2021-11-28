const Queue = require('bull');
const { db } = require('../utill/db');
const { mintNFT } = require("./NFTScripts/mintNFT");

const { doc, updateDoc } = require("firebase/firestore");

const nftQueue = new Queue('nft minting', 'redis://127.0.0.1:6379');

nftQueue.process(async function (job, done) {
    console.log(job.data);

    let UUID = job.data.UUID;
    const adminPublicKey = process.env.publicaddress;
    try {
        let ipfsHash = job.data.ipfsHash;
        let tokenId = await mintNFT({
            url: `ipfs://${ipfsHash}`
        }, adminPublicKey);

        await updateDoc(doc(db, "nfts", UUID), {
            tokenId: tokenId,
            mintStatus: "done"
        });

        console.log("done minting");
        done();
    } catch (err) {
        console.log(err);
        done();
    }

});

exports.nftQueue = nftQueue;