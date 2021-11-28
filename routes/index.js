var express = require('express');
const generator = require("generate-password");
const { v4 } = require("uuid");
const { doc, setDoc } = require("firebase/firestore");
const { db } = require("../utill/db");

var router = express.Router();

const { nftQueue } = require('../utill/nftQueue');
const { contractQueue } = require('../utill/contractQueue');
/* GET home page. */
router.get('/mintNFT', async function (req, res) {
  try {
    let UUID = v4();
    let password = generator.generate({
      length: 10,
      numbers: true
    });
    let ipfsHash = req.query.ipfsHash;
    const adminPublicKey = process.env.publicaddress;

    await setDoc(doc(db, "nfts", `${UUID}`), {
      uuid: UUID,
      password: password,
      adminPublicKey: adminPublicKey,
      name: req.query.name,
      url: `ipfs://${ipfsHash}`,
      shop: req.query.shop,
      productLink: req.query.productLink,
      sold: false,
      mintStatus: "pending"
    });

    nftQueue.add({ UUID: UUID, ipfsHash: ipfsHash });

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      UUID: UUID,
      msg: "done"
    });
  } catch (err) {
    console.log(err);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(500).json({
      msg: 'error'
    })
  }
});

router.post('/processContract', async function (req, res) {
  try {
    contractQueue.add(req.body);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      msg: "done"
    });
  } catch (err) {
    console.log(err);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(500).json({
      msg: 'error'
    })
  }
});

module.exports = router;