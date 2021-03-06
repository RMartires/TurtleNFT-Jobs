const Queue = require('bull');
const axios = require('axios');
const ethers = require('ethers');
const { Shopify, DataType, ApiVersion } = require('@shopify/shopify-api');
const { Promise } = require('bluebird');
const { doc, getDoc, updateDoc } = require("firebase/firestore");
const { getStorage, ref, getDownloadURL } = require("firebase/storage");
const config = require('../../jobs/utill/config.json');
const { db } = require('../../utill/db');
const { pinJSON } = require('../../jobs/utill/pinJSON');

Shopify.Context.initialize({
    API_KEY: process.env.SHOPIFY_API_KEY,
    API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
    SCOPES: process.env.SCOPES.split(","),
    HOST_NAME: process.env.HOST.replace(/https:\/\//, ""),
    API_VERSION: ApiVersion.October21,
    IS_EMBEDDED_APP: true,
    // This should be replaced with your preferred storage strategy
    SESSION_STORAGE: new Shopify.Session.MemorySessionStorage(),
});

const LazyTxQueue = new Queue('LazyTxTransfer', {
    redis: {
        port: 6379,
        host: process.env.REDIS_HOST,
        password: process.env.REDIS_PASSWORD,
    },
});

const gasStation = {
    "polygonMainnet": 'https://gasstation-mainnet.matic.network/',
    "polygonTestnet": 'https://gasstation-mumbai.matic.today/'
};

const blockchainScans = {
    "polygonMainnet": "https://polygonscan.com/tx/",
    "polygonTestnet": "https://mumbai.polygonscan.com/tx/"
};

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

LazyTxQueue.process(5, async function (job, done) {
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

        let nonce = null;
        let updatedTokens = order.tokens;
        let tokenID = null;

        let txs = await Promise.map(order.tokens, async (token, tdx) => {
            let abi = JSON.parse(files[tdx].data.result);
            let provider = new ethers.providers.JsonRpcProvider({ url: config[token.blockchain] });
            if (tdx == 0)
                nonce = await provider.getTransactionCount(process.env.Public_KEY);
            console.log(nonce);

            let wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
            let contractInstance = new ethers.Contract(token.contractAddress, abi, wallet);
            let r1 = await axios.get(gasStation[token.blockchain]);
            let gasPrice = r1.data['fast'] * 1000000000;

            let tx = null;

            console.log(token.status, token.tokenID);
            if (token.status != "minted" && token.status != "transfered") {
                console.log("mintblock");
                tx = await contractInstance["mint(uint256)"](1,
                    {
                        gasPrice: ethers.BigNumber.from(gasPrice),
                        nonce: nonce
                    });

                await tx.wait();
                job.progress(((tdx + 1) / order.tokens.length) * 90);

                tokenID = await new Promise((res, rej) => {
                    contractInstance.on("Transfer", (from, to, tokenId) => {
                        if (from == "0x0000000000000000000000000000000000000000" &&
                            !updatedTokens.map(t => t.tokenID).includes(parseInt(tokenId._hex))) {
                            console.log(from, to, tokenId, tdx);
                            res(parseInt(tokenId._hex));
                        }
                    });
                });

                updatedTokens[tdx].status = "minted";
                updatedTokens[tdx].tokenID = tokenID;
                await updateDoc(doc(db, "orders", job.data.orderId), {
                    tokens: updatedTokens,
                });
                nonce += 1;
            }

            console.log(nonce);

            if (token.status != "transfered") {
                console.log("transferblock");
                console.log(updatedTokens[tdx].tokenID);
                tx = await contractInstance["safeTransferFrom(address,address,uint256)"]
                    (process.env.Public_KEY, order.buyerWallet, updatedTokens[tdx].tokenID, { gasPrice: ethers.BigNumber.from(gasPrice), nonce: nonce });

                updatedTokens[tdx].status = "transfered";
                updatedTokens[tdx].hash = tx.hash;
                await updateDoc(doc(db, "orders", job.data.orderId), {
                    tokens: updatedTokens,
                });

                nonce += 1;
            }

            job.log(`minted: ${updatedTokens[tdx].tokenID} ${updatedTokens[tdx].hash}`);
            provider.polling = false;
            return { tx: tx, tokenID: tokenID, blockchain: token.blockchain };
        }, { concurrency: 1 });

        order = await getDoc(doc(db, "orders", job.data.orderId));
        order = order.data();

        await updateDoc(doc(db, "orders", job.data.orderId), {
            progress: 'transfered',
            TrackingNumbers: order.tokens.map((t) => t.hash)
        });

        let TrackingInfo = order.tokens.map((t) => ({
            number: t.hash,
            url: `${blockchainScans[t.blockchain]}${t.hash}`,
            company: 'Funggy NFT Minter'
        }));

        let admin = await getDoc(doc(db, "admins", order.shop));
        admin = admin.data();

        let fulfillData = await CreateFulfillment(admin, order.fulfillmentOrder_id, TrackingInfo);
        await updateDoc(doc(db, "orders", job.data.orderId), {
            ...fulfillData
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



async function CreateFulfillment(admin, fulfillmentOrder_id, TrackingInfo) {
    const client = new Shopify.Clients.Rest(admin.shop, admin.accessToken);
    let full = await client.post({
        path: 'fulfillments',
        data: {
            fulfillment: {
                message: "NFT transfered",
                notify_customer: true,
                line_items_by_fulfillment_order: [
                    {
                        fulfillment_order_id: fulfillmentOrder_id,
                    }
                ],
                tracking_info: TrackingInfo[0],
                tracking_urls: TrackingInfo.map(x => x.url),
                tracking_numbers: TrackingInfo.map(x => x.number),
                status: "success",
                shipment_status: 'delivered'
            }
        },
        type: DataType.JSON
    });

    return { fulfillment_name: full.body.fulfillment.name };
}


exports.LazyTxQueue = LazyTxQueue;