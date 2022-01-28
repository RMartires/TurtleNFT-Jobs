const { doc, deleteDoc } = require("firebase/firestore");
const { db } = require('../utill/db');

exports.uninstall = async function (req, res) {
    let shop = req.body.myshopify_domain;
    await deleteDoc(doc(db, "admins", shop));
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
        msg: "done"
    });
};