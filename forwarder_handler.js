const ethers = require("ethers");
const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("defender-relay-client/lib/ethers");

const speed = "fast";

// Enter your NFT address here
const allowedAddress = "0x5B660d122038F1eE1eb704d15349ACC53e9ABBaC";

const ForwarderAbi = [
  { inputs: [], stateMutability: "nonpayable", type: "constructor" },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "from", type: "address" },
          { internalType: "address", name: "to", type: "address" },
          { internalType: "uint256", name: "value", type: "uint256" },
          { internalType: "uint256", name: "gas", type: "uint256" },
          { internalType: "uint256", name: "nonce", type: "uint256" },
          { internalType: "bytes", name: "data", type: "bytes" },
        ],
        internalType: "struct MinimalForwarder.ForwardRequest",
        name: "req",
        type: "tuple",
      },
      { internalType: "bytes", name: "signature", type: "bytes" },
    ],
    name: "execute",
    outputs: [
      { internalType: "bool", name: "", type: "bool" },
      { internalType: "bytes", name: "", type: "bytes" },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "from", type: "address" },
          { internalType: "address", name: "to", type: "address" },
          { internalType: "uint256", name: "value", type: "uint256" },
          { internalType: "uint256", name: "gas", type: "uint256" },
          { internalType: "uint256", name: "nonce", type: "uint256" },
          { internalType: "bytes", name: "data", type: "bytes" },
        ],
        internalType: "struct MinimalForwarder.ForwardRequest",
        name: "req",
        type: "tuple",
      },
      { internalType: "bytes", name: "signature", type: "bytes" },
    ],
    name: "verify",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
];

async function relayGeneric(forwarder, request, signature,allowedAddress) {
  // Validate request on the forwarder contract
  const valid = await forwarder.verify(request, signature);
  if (!valid) throw new Error(`Invalid request`);

  // Check if the request is allowed only from a specific address
  if (request.to.toLowerCase() !== allowedAddress.toLowerCase()) {
    throw new Error(`Request not allowed from this address`);
  }

  // Send meta-tx through relayer to the forwarder contract
  const gasLimit = (parseInt(request.gas) + 50000).toString();
  return await forwarder.execute(request, signature, { gasLimit });
}

async function handler(event) {
  // Parse webhook payload
  if (!event.request || !event.request.body) throw new Error(`Missing payload`);
  const { type } = event.request.body;

  console.log("Type", type);

  // Initialize Relayer provider and signer, and forwarder contract
  const credentials = { ...event };
  const provider = new DefenderRelayProvider(credentials);
  const signer = new DefenderRelaySigner(credentials, provider, {
    speed,
  });

  let tx;

  if (type == "forward") {
    // Gasless tx
    const { request, signature, forwarderAddress } = event.request.body;
    console.log(forwarderAddress);

    // Initialize forwarder contract
    const forwarder = new ethers.Contract(
      forwarderAddress,
      ForwarderAbi,
      signer
    );

    console.log(`Relaying`, request);
    console.log(`Signature`, signature);
    
    // fix ledger live where signature result in v = 0, 1.
    const fixedSig = ethers.utils.joinSignature(ethers.utils.splitSignature(signature));
    
    console.log(`Fixed Signature`, fixedSig);

    tx = await relayGeneric(forwarder, request, fixedSig, allowedAddress);
  } else {
    throw new Error(
      `Invalid gasless transaction type. Provide type 'forwarder'.`
    );
  }

  console.log(`Sent meta-tx: ${tx.hash}`);
  return { txHash: tx.hash, txResponse: tx };
}

module.exports = {
  handler,
};