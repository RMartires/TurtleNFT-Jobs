const { Shopify, DataType, ApiVersion } = require('@shopify/shopify-api');
const { doc, getDoc, updateDoc } = require("firebase/firestore");
const { db } = require('../utill/db');

exports.applicationCharge = async (req, res) => {
    try {

        let admin = await getDoc(doc(db, "admins", req.query.shop));
        if (!admin.exists()) throw new Error("Error: no admin");
        admin = admin.data();

        const client = new Shopify.Clients.Rest(admin.shop, admin.accessToken);
        let data = null;

        data = await client.post({
            path: 'recurring_application_charges',
            data: {
                "recurring_application_charge": {
                    "name": "Fungyy application charge",
                    "price": 0,
                    "return_url": `https://turtle-nft.herokuapp.com/?shop=${admin.shop}&plan=applicationCharge&host=${admin.host}`,
                    "capped_amount": 1000,
                    "terms": "$1 + (5% NFT sale price) per NFT sold",
                    "test": process.env.TestCharge
                }
            },
            type: DataType.JSON,
        });

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(200).json({
            data: data.body.recurring_application_charge
        });
    } catch (err) {
        console.log(err);
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(500).json({
            err: err.message
        });
    }
};


exports.checkNFTSellerStatus = async (req, res) => {
    try {
        let admin = await getDoc(doc(db, "admins", req.query.shop));
        if (!admin.exists()) throw new Error("Error: no admin");
        admin = admin.data();

        Shopify.Context.initialize({
            ...Shopify.Context,
            API_VERSION: ApiVersion.Unstable
        });
        const client = new Shopify.Clients.Graphql(admin.shop, admin.accessToken);
        client.accessToken

        const r = await client.query({
            data: {
                query: `query {
                    nftSalesEligibility {
                        sellApproved
                        reapplyDate
                    }
                  }`
            }
        });

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(201).json({
            data: r.body.nftSalesEligibilityStatus.sellApproved
        });

    } catch (err) {
        console.log(err);
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(500).json({
            err: err.message
        });
    }
};