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

    const mintAccount = new anchor.web3.PublicKey("4NPsT5T2gMgHGjePc9Zvk72kk4uBPSL1auBqBhUNhWjW")
    // let mintAccount = await createMint(provider.connection, signer, deployer, deployer, 0)
    console.log("mintAccount", mintAccount.toBase58())
    const toAccount = new anchor.web3.PublicKey("GoCS7jAZm6TCJwAtJsuU7C5FmWtt82YaZTyAHLewvv1C")

    let userTokenAccount = await getAssociatedTokenAddressSync(mintAccount, toAccount)
    let ai = await provider.connection.getAccountInfo(userTokenAccount)
    if (!ai) {
        const userTokenAccount = await createTokenAccount(provider.connection, signer, mintAccount, toAccount)
        ai = await provider.connection.getAccountInfo(userTokenAccount)
    }
    console.log("userTokenAccount", userTokenAccount.toBase58(), ai)

    await mintTo(provider.connection, signer, mintAccount, userTokenAccount, deployer, 10000)
}
