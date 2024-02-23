// Migrations are an early feature. Currently, they're nothing more than this
// single deploy script that's invoked from the CLI, injecting a provider
// configured from the workspace's Anchor.toml.

const path = require("path")
const anchor = require("@coral-xyz/anchor");
const spl = require("@solana/spl-token");
// const { SystemProgram } = require("@solana/web3.js")
import {
    createAssociatedTokenAccount,
    getAssociatedTokenAddressSync, createMint,
    createAccount as createTokenAccount, mintTo,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID
} from "@solana/spl-token"

module.exports = async function (provider) {
    const signer = anchor.Wallet.local().payer
    const deployer = signer.publicKey
    console.log("to deploy", deployer, TOKEN_PROGRAM_ID)
    // Configure client to use the provider.
    anchor.setProvider(provider);
    const idl = JSON.parse(require('fs').readFileSync(path.join(__dirname, '..', './target/idl/aa.json'), 'utf8'));
    const programId = new anchor.web3.PublicKey('AtjBMK1fjoXw3sBiMBJkyStuPT1S87DU1mMvmGanN3hq');
    const program = new anchor.Program(idl, programId);
    const [configPda, bump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from('config')], programId);

    const newOwner = new anchor.web3.PublicKey("GoCS7jAZm6TCJwAtJsuU7C5FmWtt82YaZTyAHLewvv1C")
    await program.rpc.transferOwner(newOwner, {
        accounts: {
            config: configPda,
            owner: deployer,
        },
        signers: [signer],
    })
}
