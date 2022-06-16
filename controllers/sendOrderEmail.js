const axios = require("axios");
const { CreateEmailHTML } = require("./EmailTemplate");
const { doc, getDoc, updateDoc } = require("firebase/firestore");
const { db } = require('../utill/db');


exports.sendOrderEmail = async (req, res) => {
    try {
        const logo_url = "https://cdn.shopify.com/s/files/applications/225502fff58725331172e05f24236044.png?1651912368";
        const contact_email = "tophatturtlehq@gmail.com";

        let buyer = req.body.buyer;
        let order = req.body.order;

        let docData = await getDoc(doc(db, "admins", order.shop));
        docData = docData.data();
        let template = (docData.email && docData.email.type == "custom") ? docData.email.template : "default";

        var mail = {
            from: {
                email: "info@pepisandbox.com",//"info@tophatturtle.in",
                name: "Fungyy"
            },
            subject: `Your NFT Order from ${order.shop}`,
            content: [{
                type: "html",
                value: CreateEmailHTML(template, {
                    title: `Congrats on your NFT order from ${order.shop}`,
                    logo_url: logo_url,
                    body_1: "This email will enable you to claim your NFTs",
                    body_2: "use the below claim link and password to login",
                    artist: order.shop,
                    link: order.link,
                    password: order.password,
                    email: contact_email
                }),
            }],
            personalizations: [
                {
                    to: [
                        {
                            email: buyer.email,
                            name: buyer.name
                        }
                    ]
                }
            ],
        };

        await axios({
            method: "post",
            url: "https://api.pepipost.com/v5.1/mail/send",
            data: mail,
            headers: {
                "Content-Type": "application/json",
                "api_key": process.env.email_API_KEY
            }
        });
        res.status(200).json({
            msg: "done",
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            msg: err.message,
        });
    }
};
