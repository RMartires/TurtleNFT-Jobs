const axios = require("axios");

const IPFS_BASE_URL = process.env.NEXT_PUBLIC_IPFS_BASE_URL;
const IPFS_JWT = process.env.NEXT_PUBLIC_IPFS_JWT;

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
