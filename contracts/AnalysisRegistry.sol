// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AnalysisRegistry {
    uint256 public projectCount = 0;
    
    mapping(uint256 => uint256) public analysisProjectIds;
    mapping(uint256 => string) public analysisCids;
    mapping(uint256 => string) public analysisMetadatas;
    mapping(uint256 => uint256) public analysisTimestamps;
    mapping(uint256 => string) public analysisContractAddresses;
    
    mapping(string => bool) public cidExists;
    mapping(address => bool) public authorizedCallers;
    
    event AnalysisStored(
        uint256 indexed projectId, 
        string cid, 
        address indexed storedBy,
        uint256 timestamp
    );
    
    event ContractAuthorized(address indexed caller);
    event ContractDeauthorized(address indexed caller);
    
    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender], "No autorizado");
        _;
    }
    
    constructor() {
        authorizedCallers[msg.sender] = true;
    }
    
    function authorizeContract(address _contract) external onlyAuthorized {
        authorizedCallers[_contract] = true;
        emit ContractAuthorized(_contract);
    }
    
    function deauthorizeContract(address _contract) external onlyAuthorized {
        authorizedCallers[_contract] = false;
        emit ContractDeauthorized(_contract);
    }
    
    function storeAnalysis(
        string calldata cid,
        string calldata metadata,
        string calldata contractAddress
    ) external onlyAuthorized returns (uint256) {
        require(bytes(cid).length > 0, "CID requerido");
        require(bytes(contractAddress).length > 0, "Direccion requerida");
        require(!cidExists[cid], "CID ya existe");
        
        projectCount++;
        
        analysisProjectIds[projectCount] = projectCount;
        analysisCids[projectCount] = cid;
        analysisMetadatas[projectCount] = metadata;
        analysisTimestamps[projectCount] = block.timestamp;
        analysisContractAddresses[projectCount] = contractAddress;
        
        cidExists[cid] = true;
        
        emit AnalysisStored(projectCount, cid, msg.sender, block.timestamp);
        
        return projectCount;
    }
    
    function getAnalysis(uint256 id) external view returns (
        uint256 _projectId,
        string memory _cid,
        string memory _metadata,
        uint256 _timestamp,
        string memory _contractAddress
    ) {
        require(id > 0 && id <= projectCount, "ID invalido");
        
        return (
            analysisProjectIds[id],
            analysisCids[id],
            analysisMetadatas[id],
            analysisTimestamps[id],
            analysisContractAddresses[id]
        );
    }
    
    function getLatestAnalysis() external view returns (
        uint256 _projectId,
        string memory _cid,
        string memory _metadata,
        uint256 _timestamp,
        string memory _contractAddress
    ) {
        require(projectCount > 0, "Sin analisis");
        uint256 latestId = projectCount;
        return (
            analysisProjectIds[latestId],
            analysisCids[latestId],
            analysisMetadatas[latestId],
            analysisTimestamps[latestId],
            analysisContractAddresses[latestId]
        );
    }
    
    function getAnalysisCount() external view returns (uint256) {
        return projectCount;
    }
    
    function cidExistsCheck(string calldata cid) external view returns (bool) {
        return cidExists[cid];
    }
}
