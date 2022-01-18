const { createProducts } = require('../utill/createProducts');
const { doc, getDoc, updateDoc } = require("firebase/firestore");
const axios = require('axios');
const { db } = require('../utill/db');

const blockchains = {
    "polygonTestnet": "Polygon Testnet",
    "polygonMainnet": "Polygon"
};

exports.CreateProduct = async (req, res) => {
    try {
        let contract = await getDoc(doc(db, "contracts", req.query.contractFileName));
        if (!contract.exists()) throw new Error(`Error: contract ${req.query.contractFileName} does not exist`);
        contract = contract.data();

        let data = await axios.get(`https://ipfs.io/ipfs/${contract.tokens[0].image}`, {
            responseType: 'arraybuffer'
        });
        let encoded = Buffer.from(data.data, 'binary').toString('base64');

        await createProducts({
            shop: `${req.query.user}.myshopify.com`,
            body_html: `<h2>${contract.contractName}</h2>
                <h4>Symbol: ${contract.contractSymbol}</h4>
                <h4>Contract Address: ${contract.contractAddress}</h4>
                <h4>Blockchain: ${blockchains[contract.blockchain]}</h4>
                `,
            title: contract.contractName,
            tags: ["NFT"],
            contractDocName: req.query.contractFileName,
            image64: encoded,
            supply: contract.tokens[0].number,
            price: contract.tokens[0].price
        });

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(200).json({
            msg: "Product Created"
        });
    } catch (err) {
        console.log(err);
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(500).json({
            msg: "err"
        });
    }
};