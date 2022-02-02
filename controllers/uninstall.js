const { doc, deleteDoc, collection, query, where, getDocs } = require("firebase/firestore");
const { db } = require('../utill/db');
const { Promise } = require('bluebird');
const { verifyWebhook } = require("../utill/verifyWebhook");

exports.uninstall = async function (req, res) {
    try {
        if (!req.auth) throw new Error("Unauthorized");
        let shop = req.body.myshopify_domain;
        await deleteDoc(doc(db, "admins", shop));

        let contractSnap = await getDocs(query(collection(db, "contracts"), where("shop", "==", shop)));
        let contracts = [];
        contractSnap.forEach(el => contracts.push(el.id));
        await Promise.map(contracts, (id) => {
            return deleteDoc(doc(db, "contracts", id));
        }, { concurrency: 5 });

        let ordersSnap = await getDocs(query(collection(db, "orders"), where("shop", "==", shop)));
        let orders = [];
        ordersSnap.forEach(el => orders.push(el.id));
        await Promise.map(orders, (id) => {
            return deleteDoc(doc(db, "orders", id));
        }, { concurrency: 5 });

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(200).json({
            msg: "done"
        });
    } catch (err) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        if (err.message == "Unauthorized") {
            res.status(401).json({
                msg: 'Unauthorized'
            });
        } else {
            res.status(500).json({
                msg: 'error'
            });
        }
    }
};