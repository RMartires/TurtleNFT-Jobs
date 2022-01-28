const { doc, deleteDoc, collection, query, where, getDocs } = require("firebase/firestore");
const { db } = require('../utill/db');
const { Promise } = require('bluebird');

exports.uninstall = async function (req, res) {
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
};