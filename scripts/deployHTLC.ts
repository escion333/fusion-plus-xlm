import dotenv from 'dotenv';

dotenv.config();

// Parameters from our swap order
const ORDER_HASH = "0x3459ce559a8b2d274e6fe0b127f8671ec0bce4ddb91ba0059f07641079f4a160";
const SECRET_HASH = "0x626bbd9b6e9f5ae249bff1a754421bf9cea9a00475fa3d117c66f76ba038fe03";
const HTLC_ID = "CALNCI5AP4VEAEQSIAOK3G6FXMKXB4JZLZ6W5TZE44QP4ACVO7BJLS6I";
const USDC_CONTRACT = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const AMOUNT = "5000000"; // 5 USDC (6 decimals)
const SAFETY_DEPOSIT = "0";

// Participants
const MAKER = "GDIY6AQQ75WMD4W46EYB7O6UYMHOCGQHLAQGQTKHDX4J2DYQCHVCR4W4"; // User wallet
const TAKER = process.env.DEMO_STELLAR_RESOLVER || "GA5J2WRMKZIWX5DMGAEXHHYSEWTEMSBCQGIK6YGDGYJWDL6TFMILVQWK"; // Resolver

function generateTimelocks(): string {
  const currentTime = Math.floor(Date.now() / 1000);
  
  // Pack timelocks into u64 (8 bytes, each timelock gets 1 byte)
  const baseTime = currentTime;
  const toHours = (timestamp: number) => Math.min(255, Math.floor((timestamp - baseTime) / 3600));
  
  const timelocks = {
    srcWithdrawal: currentTime + 3600, // 1 hour
    srcPublicWithdrawal: currentTime + 7200, // 2 hours
    srcCancellation: currentTime + 10800, // 3 hours
    srcPublicCancellation: currentTime + 14400, // 4 hours
    dstWithdrawal: currentTime + 1800, // 30 minutes
    dstPublicWithdrawal: currentTime + 3600, // 1 hour
    dstCancellation: currentTime + 5400, // 1.5 hours
    dstPublicCancellation: currentTime + 7200, // 2 hours
  };
  
  // Pack into u64
  const packed = BigInt(toHours(timelocks.srcWithdrawal)) |
                (BigInt(toHours(timelocks.srcPublicWithdrawal)) << BigInt(8)) |
                (BigInt(toHours(timelocks.srcCancellation)) << BigInt(16)) |
                (BigInt(toHours(timelocks.srcPublicCancellation)) << BigInt(24)) |
                (BigInt(toHours(timelocks.dstWithdrawal)) << BigInt(32)) |
                (BigInt(toHours(timelocks.dstPublicWithdrawal)) << BigInt(40)) |
                (BigInt(toHours(timelocks.dstCancellation)) << BigInt(48)) |
                (BigInt(toHours(timelocks.dstPublicCancellation)) << BigInt(56));
  
  return packed.toString();
}

function generateDeployCommand(): string {
  const timelocks = generateTimelocks();
  const orderHashHex = ORDER_HASH.startsWith('0x') ? ORDER_HASH.slice(2) : ORDER_HASH;
  const secretHashHex = SECRET_HASH.startsWith('0x') ? SECRET_HASH.slice(2) : SECRET_HASH;
  
  console.log('🔧 HTLC Deployment Parameters');
  console.log('=============================');
  console.log(`HTLC ID: ${HTLC_ID}`);
  console.log(`Token: ${USDC_CONTRACT}`);
  console.log(`Amount: ${AMOUNT} (5 USDC)`);
  console.log(`Order Hash: ${orderHashHex}`);
  console.log(`Secret Hash: ${secretHashHex}`);
  console.log(`Maker: ${MAKER}`);
  console.log(`Taker: ${TAKER}`);
  console.log(`Safety Deposit: ${SAFETY_DEPOSIT}`);
  console.log(`Timelocks: ${timelocks}`);
  
  const command = `stellar contract invoke \\
  --id ${HTLC_ID} \\
  --source-account $STELLAR_TEST_WALLET_SECRET \\
  --network public \\
  -- deploy \\
  --token ${USDC_CONTRACT} \\
  --amount ${AMOUNT} \\
  --order_hash ${orderHashHex} \\
  --timelocks ${timelocks} \\
  --hashlock ${secretHashHex} \\
  --maker ${MAKER} \\
  --safety_deposit ${SAFETY_DEPOSIT} \\
  --taker ${TAKER}`;
  
  console.log('\n🚀 Deploy Command:');
  console.log('=================');
  console.log(command);
  
  return command;
}

generateDeployCommand();