const Queue = require('bull');
const axios = require('axios');
const ethers = require('ethers');
const { Promise } = require('bluebird');
const { doc, getDoc, updateDoc } = require("firebase/firestore");
const { getStorage, ref, getDownloadURL } = require("firebase/storage");
const config = require('../jobs/utill/config.json');
const { db } = require('../utill/db');
const { pinJSON } = require('../jobs/utill/pinJSON');

const transferQueue = new Queue('Transfer', 'redis://127.0.0.1:6379');

transferQueue.process(async function (job, done) {
    console.log(job.data);
    try {
        let order = await getDoc(doc(db, "orders", job.data.orderId));
        if (!order.exists()) throw new Error(`Error: contract ${job.data.orderId} does not exist`);
        order = order.data();

        const storage = getStorage();
        const ABI_URLs = await Promise.map(order.tokens, (token) => {
            return getDownloadURL(ref(storage, `artifacts/${token.contractName}_${token.shop.split(".")[0]}.json`));
        });
        const files = await Promise.map(ABI_URLs, (url) => {
            return axios({
                method: 'get',
                url: url
            });
        });

        job.progress(33);

        let ipfsArr = await Promise.map(order.tokens, (token) => {
            return pinJSON({
                filename: token.filename,
                data: token.metaData
            });
        });

        job.progress(50);

        let txs = await Promise.map(order.tokens, (token, tdx) => {
            let abi = files[tdx].data.abi;
            let provider = new ethers.providers.JsonRpcProvider({ url: config[token.blockchain] });
            let wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
            let contractInstance = new ethers.Contract(token.contractAddress, abi, wallet);
            return contractInstance["createNFT(address,string,uint256)"](order.buyerWallet, ipfsArr[tdx], token.tokenId);
        });

        await updateDoc(doc(db, "orders", job.data.orderId), {
            tokens: order.tokens.map((x, xdx) => ({ ...x, hash: txs[xdx].hash })),
            progress: 'transfered'
        });

        job.progress(100);

        console.log("done");
        job.log("done");
        job.progress(100);
        done();
    } catch (err) {
        console.log(err);
        done(new Error(err.message));
    }
});


exports.transferQueue = transferQueue;