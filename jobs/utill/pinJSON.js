const axios = require("axios");
const FormData = require("form-data");
const { createCanvas, loadImage } = require('canvas');
const pinataSDK = require('@pinata/sdk');
const IPFS_BASE_URL = process.env.NEXT_PUBLIC_IPFS_BASE_URL;
const IPFS_JWT = process.env.NEXT_PUBLIC_IPFS_JWT;
const pinata = pinataSDK(process.env.NEXT_PUBLIC_IPFS_KEY, process.env.NEXT_PUBLIC_IPFS_SECRET);

exports.pinJSON = async (data) => {
    const url = `${IPFS_BASE_URL}/pinning/pinJSONToIPFS`;
    const r = await axios
        .post(url, {
            pinataMetadata: {
                name: data.filename
            },
            pinataContent: data.data
        }, {
            headers: {
                Authorization: `Bearer ${IPFS_JWT}`
            }
        });
    return r.data.IpfsHash;
};

exports.pinFile = async (data) => {
    let readableStreamForFile = await new Promise((resolve, rej) => {
        axios.get(data.image_url, {
            responseType: 'stream'
        }).then(res => {
            resolve(res.data);
        }).catch(err => {
            rej(err);
        });
    });

    let hash = await pinata.pinFileToIPFS(readableStreamForFile);
    return hash.IpfsHash;
};