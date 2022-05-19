const fs = require('fs/promises');
const { contractTemplate, contractGenArtTemplate } = require('./contractTemplate');

exports.createContract = async (filename, contractName, contractSymbol, totalSupply, genArt) => {
    if (genArt)
        await fs.writeFile(`${__dirname}/../../contracts/${filename}.sol`, contractGenArtTemplate(contractName, contractSymbol, { totalSupply: totalSupply }));
    else
        await fs.writeFile(`${__dirname}/../../contracts/${filename}.sol`, contractTemplate(contractName, contractSymbol, { totalSupply: totalSupply }));
}