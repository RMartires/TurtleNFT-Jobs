const { Shopify, DataType, ApiVersion } = require('@shopify/shopify-api');
const { doc, getDoc, updateDoc } = require("firebase/firestore");
const { db } = require('../utill/db');

exports.ChangePlan = async (req, res) => {
    try {
        const plans = {
            basic: 35,
            premium: 250,
            ultimate: 750
        };

        let admin = await getDoc(doc(db, "admins", req.query.shop));
        if (!admin.exists()) throw new Error("Error: no admin");
        admin = admin.data();

        const client = new Shopify.Clients.Rest(admin.shop, admin.accessToken);
        const data = await client.post({
            path: 'recurring_application_charges',
            data: {
                "recurring_application_charge": {
                    "name": req.query.plan,
                    "price": plans[req.query.plan],
                    "return_url": `https://a78e-103-119-209-82.ngrok.io/?shop=${admin.shop}&plan=${req.query.plan}&host=${admin.host}`,
                    "trial_days": 7,
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