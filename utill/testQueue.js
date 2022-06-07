const Queue = require('bull');
const axios = require('axios');

const testQueue = new Queue('Test', {
    redis: {
        port: 6379,
        host: process.env.REDIS_HOST,
        password: process.env.REDIS_PASSWORD,
    },
});

testQueue.process(5, async function (job, done) {
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

        job.progress(50);

        let txs = await Promise.map(order.tokens, async (token, tdx) => {

            let hash = ipfsArr[tdx];
            let URI = `https://ipfs.io/ipfs/${hash}`;
            let mintArgs = [order.buyerWallet, URI];
            let mintFunction = "createNFT(address,string)";


            if (token.type == "genArtContract") {
                mintFunction = "createNFT(address,string,uint256)";
                let args = await genArtContractSetup(token);
                mintArgs = [order.buyerWallet, ...args];
            } else if (token.type == "genArtContract") {
                mintFunction = "createNFT(address,string,uint256)";
                let args = [URI, token.RandomId];
                mintArgs = [order.buyerWallet, ...args];
            }

            let abi = files[tdx].data.abi;
            let provider = new ethers.providers.JsonRpcProvider({ url: config[token.blockchain] });
            let nonce = await provider.getTransactionCount(process.env.Public_KEY);

            let wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
            let contractInstance = new ethers.Contract(token.contractAddress, abi, wallet);

            console.log(mintArgs);
            let r1 = await axios.get(gasStation[token.blockchain]);
            let gasPrice = r1.data['fast'] * 1000000000;

            let tx = await contractInstance[mintFunction](...mintArgs,
                {
                    gasPrice: ethers.BigNumber.from(gasPrice),
                    nonce: nonce
                });

            let tokenID = await new Promise((res, rej) => {
                contractInstance.on("ValueChanged", (author, newValue, event) => {
                    res(parseInt(newValue._hex));
                });
            });
            job.log(`minted: ${tokenID} ${tx.hash}`);
            return { tx: tx, tokenID: tokenID, blockchain: token.blockchain };
        }, { concurrency: 1 });

        await updateDoc(doc(db, "orders", job.data.orderId), {
            tokens: order.tokens.map((x, xdx) => ({ ...x, hash: txs[xdx].tx.hash, tokenId: txs[xdx].tokenID })),
            progress: 'transfered',
            TrackingNumbers: txs.map((tx) => tx.tx.hash)
        });

        let TrackingInfo = txs.map((tx) => ({
            number: tx.tx.hash,
            url: `${blockchainScans[tx.blockchain]}${tx.tx.hash}`,
            company: 'Funggy NFT Minter'
        }));

        // let txs = order.tokens;
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

exports.testQueue = testQueue;