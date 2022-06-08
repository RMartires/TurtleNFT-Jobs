exports.contractTemplate = (contractName, contractSymbol, data) => {

    return `//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ${contractName} is ERC721URIStorage {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    // Constants
    uint256 public constant TOTAL_SUPPLY = ${data.totalSupply};

    event ValueChanged(address indexed author, uint256 tokenId);

    constructor() ERC721("${contractName}", "${contractSymbol}") {}

    function createNFT(address recipient, string memory uri)
        public
        returns (uint256)
    {
        uint256 currenttokenId = _tokenIds.current();
        require(currenttokenId <= TOTAL_SUPPLY, "Max supply reached");

        _tokenIds.increment();
        
        uint256 newItemId = _tokenIds.current();
        _mint(recipient, newItemId);
        _setTokenURI(newItemId, uri);

        emit ValueChanged(msg.sender, newItemId);

        return newItemId;
    }
}`;
};

exports.contractGenArtTemplate = (contractName, contractSymbol, data) => {

    return `//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ${contractName} is ERC721URIStorage {
    using Counters for Counters.Counter;

    // Constants
    uint256 public constant TOTAL_SUPPLY = ${data.totalSupply};

    event ValueChanged(address indexed author, uint256 tokenId);

    constructor() ERC721("${contractName}", "${contractSymbol}") {}

    function createNFT(address recipient, string memory uri, uint256 newItemId)
        public
        returns (uint256)
    {
        require(newItemId <= TOTAL_SUPPLY, "Max supply reached");

        _mint(recipient, newItemId);
        _setTokenURI(newItemId, uri);

        emit ValueChanged(msg.sender, newItemId);

        return newItemId;
    }
}`;
};