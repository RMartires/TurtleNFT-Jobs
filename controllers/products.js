const https = require("https");
const { createProducts } = require('../utill/createProducts');
const { doc, getDoc, updateDoc, getDocs, query, collection, where } = require("firebase/firestore");
const { getStorage, ref, getDownloadURL } = require("firebase/storage");
const axios = require('axios');
const { Shopify, DataType, ApiVersion } = require('@shopify/shopify-api');
const { db } = require('../utill/db');
const { createGif } = require('../utill/createGif');

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

const CreateProductService = async (user, contractFileName) => {
    let contract = await getDoc(doc(db, "contracts", contractFileName));
    if (!contract.exists()) throw new Error(`Error: contract ${contractFileName} does not exist`);
    contract = contract.data();

    let data = null;

    if (contract?.type == "genArtContract") {
        const storage = getStorage();
        let storageRef = ref(storage, `users/${contract.shop.split(".")[0]}/${contract.contractName}/gifFile.gif`);
        let url = await getDownloadURL(storageRef);
        data = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 100000,
            httpsAgent: new https.Agent({ keepAlive: true }),
        });
    } if (contract?.type == "multi-asset") {
        data = await createGif(contract.tokens.map(token => token.image));
    } else {
        try {
            data = await axios.get(`https://ipfs.io/ipfs/${contract.tokens[0].image}`, {
                responseType: 'arraybuffer',
                timeout: 100000,
                httpsAgent: new https.Agent({ keepAlive: true }),
            });
        } catch (err) {
            console.log(err)
            data = await axios.get(`https://gateway.pinata.cloud/ipfs/${contract.tokens[0].image}`, {
                responseType: 'arraybuffer',
                timeout: 100000,
                httpsAgent: new https.Agent({ keepAlive: true }),
            });
        }

    }

    let encoded = Buffer.from(data.data, 'binary').toString('base64');

    let supply = contract.tokens[0].number;
    let price = contract.tokens[0].price;

    if (contract?.type == "multi-asset") {
        supply = contract.tokens.reduce((acc, curr) => acc + curr.number, 0);
        price = contract.price;
    }
    await createProducts({
        shop: `${user}.myshopify.com`,
        body_html: `<h2>${contract.contractName}</h2>
                <h4>Symbol: ${contract.contractSymbol}</h4>
                <h4>Contract Address: ${contract.contractAddress}</h4>
                <h4>Blockchain: ${blockchains[contract.blockchain]}</h4>
                `,
        title: contract.contractName,
        tags: ["NFT"],
        contractDocName: contractFileName,
        image64: encoded,
        supply: supply,
        price: price
    });

    return;
};


exports.productUpdateWebhook = async (req, res) => {
    try {
        // if (!req.auth) throw new Error("Unauthorized");
        const shop = req.body.shop;

        const gqlId = req.body.product.admin_graphql_api_id;
        let variants = req.body.product.variants;
        variants = variants.map(v => v.id);

        let shopData;
        const querySnapshot = await getDocs(query(collection(db, "admins"), where("shop", "==", shop)));
        querySnapshot.forEach((doc) => {
            shopData = doc.data();
        });

        const graphQLClient = new Shopify.Clients.Graphql(shopData.shop, shopData.accessToken);

        const QUERY_METAFIELDS = `query {
            metafield(first: 100, owner: "${gqlId}") {
              edges {
                node {
                  namespace
                  key
                  value
                }
              }
            }
          }`;

        let r = await graphQLClient.query({
            data: {
                query: QUERY_METAFIELDS
                // variables: {
                //     owner: gqlId
                // }
            }
        });


        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(200).json({
            msg: "recived product update info"
        });

    } catch (err) {
        console.log(err);
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(500).json({
            msg: "err"
        });
    }
};

exports.CreateProductService = CreateProductService;