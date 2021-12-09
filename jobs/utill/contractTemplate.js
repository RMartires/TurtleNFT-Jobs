exports.contractTemplate = (contractName, contractSymbol) => {

    return `//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ${contractName} is ERC721URIStorage {
   
    event ValueChanged(address indexed author, uint256 tokenId);

    constructor() ERC721("${contractName}", "${contractSymbol}") {}

    function createNFT(address recipient, string memory uri, uint256 newItemId)
        public
        returns (uint256)
    {
        _mint(recipient, newItemId);
        _setTokenURI(newItemId, uri);

        emit ValueChanged(msg.sender, newItemId);

        return newItemId;
    }
}`;
};