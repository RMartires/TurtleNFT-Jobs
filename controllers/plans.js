const { Shopify, DataType, ApiVersion } = require('@shopify/shopify-api');
const { doc, getDoc, updateDoc } = require("firebase/firestore");
const { db } = require('../utill/db');

exports.ChangePlan = async (req, res) => {
    try {
        const plans = {
            basic: 0,
            premium: 50,
            ultimate: 100
        };

        let admin = await getDoc(doc(db, "admins", req.query.shop));
        if (!admin.exists()) throw new Error("Error: no admin");
        admin = admin.data();

        const client = new Shopify.Clients.Rest(admin.shop, admin.accessToken);
        let data = null;

        data = await client.post({
            path: 'recurring_application_charges',
            data: {
                "recurring_application_charge": (req.query.plan == "basic") ?
                    {
                        "name": req.query.plan,
                        "price": plans[req.query.plan],
                        "return_url": `https://turtle-nft.herokuapp.com/?shop=${admin.shop}&plan=${req.query.plan}&host=${admin.host}`,
                        "capped_amount": 1,
                        "terms": "$1 wont be charged",
                        "test": process.env.TestCharge
                    } :
                    {
                        "name": req.query.plan,
                        "price": plans[req.query.plan],
                        "return_url": `https://turtle-nft.herokuapp.com/?shop=${admin.shop}&plan=${req.query.plan}&host=${admin.host}`,
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
