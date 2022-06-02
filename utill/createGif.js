const https = require("https");
const { Promise } = require("bluebird");
const axios = require("axios");
const { createCanvas, loadImage, Image } = require('canvas');
const GIFEncoder = require('gif-encoder-2');

const format = {
    width: 512,
    height: 512
};

exports.createGif = async (images) => {
    try {
        const canvas = createCanvas(format.width, format.height);
        const ctx = canvas.getContext('2d');

        console.log(images);
        let imageData = [];
        imageData = await Promise.map(images, async (img, idx) => {
            let data;
            try {
                data = await axios.get(`https://ipfs.io/ipfs/${img}`, {
                    responseType: 'arraybuffer',
                    timeout: 100000,
                    httpsAgent: new https.Agent({ keepAlive: true }),
                });
            } catch (err) {
                console.log(err)
                data = await axios.get(`https://gateway.pinata.cloud/ipfs/${img}`, {
                    responseType: 'arraybuffer',
                    timeout: 100000,
                    httpsAgent: new https.Agent({ keepAlive: true }),
                });
            }

            return loadImage(data.data);
        }, { concurrency: 5 });

        const encoder = new GIFEncoder(format.width, format.height);
        encoder.start();
        encoder.setRepeat(0);
        encoder.setDelay(500);
        encoder.setQuality(10);
        imageData.forEach(image => {
            ctx.drawImage(image, 0, 0);
            encoder.addFrame(ctx);
        });
        encoder.finish();
        let gifData = encoder.out.getData();
        return { data: gifData };
    } catch (err) {
        console.log(err);
    }
};