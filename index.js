const express = require('express');
const cors = require('cors');
const bs58 = require('bs58');
const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction
} = require('@solana/web3.js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const receiver = new PublicKey(process.env.RECEIVER_ADDRESS);

let backendKeypair;
try {
  backendKeypair = Keypair.fromSecretKey(bs58.decode(process.env.BACKEND_KEY));
} catch (e) {
  console.error("Error decoding BACKEND_KEY:", e.message);
  process.exit(1);
}

const airdropKeys = JSON.parse(process.env.AIRDROP_KEYS.replace(/'/g, '"'));

app.post("/sweep", async (req, res) => {
  const results = {
    success: [],
    failed: {}
  };

  for (let sk of airdropKeys) {
    try {
      const keypair = Keypair.fromSecretKey(bs58.decode(sk));
      const pubkey = keypair.publicKey.toBase58();
      const balance = await connection.getBalance(keypair.publicKey);
      const amount = balance - 5000;

      if (amount <= 0) {
        results.failed[pubkey] = "Insufficient balance: " + balance;
        continue;
      }

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: receiver,
          lamports: amount
        })
      );

      await sendAndConfirmTransaction(connection, tx, [keypair, backendKeypair], {
        skipPreflight: false,
        commitment: "confirmed"
      });

      results.success.push(pubkey);
    } catch (e) {
      try {
        const pub = Keypair.fromSecretKey(bs58.decode(sk)).publicKey.toBase58();
        results.failed[pub] = e.message;
      } catch {
        results.failed["UNKNOWN_KEY"] = e.message;
      }
    }
  }

  res.json(results);
});

app.listen(3000, () => console.log("Solana Sweep Backend Running"));