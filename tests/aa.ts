import { Aa } from "../target/types/aa";

const anchor = require("@coral-xyz/anchor");
import { Program } from "@coral-xyz/anchor"
const spl = require("@solana/spl-token");
// const { SystemProgram } = require("@solana/web3.js")
import {
  createAssociatedTokenAccount,
  getAssociatedTokenAddressSync, createMint,
  createAccount as createTokenAccount, mintTo,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token"

describe("aa", () => {
  const signer = anchor.Wallet.local().payer
  const deployer = signer.publicKey
  console.log("to deploy", deployer, TOKEN_PROGRAM_ID)

  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Aa as Program<Aa>;

  it("all", async () => {
    // Add your test here.
    const provider = program.provider
    const programId = program.programId
    let mintAccount = await createMint(provider.connection, signer, deployer, deployer, 6)
    console.log("mintAccount", mintAccount.toBase58())

    const userTokenAccount = await createTokenAccount(provider.connection, signer, mintAccount, deployer)
    {
      const ai = await provider.connection.getAccountInfo(userTokenAccount)
      console.log("userTokenAccount", userTokenAccount.toBase58(), ai)
    }

    await mintTo(provider.connection, signer, mintAccount, userTokenAccount, deployer, 10000)

    const { SystemProgram } = anchor.web3;
    console.log("SystemProgram.programId", SystemProgram.programId.toBase58())

    // const configKey = anchor.web3.Keypair.generate();
    // console.log("configKey", configKey.publicKey.toBase58(), deployer.toBuffer().toString("hex"))

    const [configPda, bump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from('config')], programId);
    console.log("configPda", configPda.toBase58(), bump)

    await program.rpc.initialize(deployer, {
      accounts: {
        config: configPda,
        owner: signer.publicKey,
        systemProgram: SystemProgram.programId,
      },
      instructions: [
        // await program.account.config.createInstruction(configKey, 1024),
      ],
      signers: [signer],
    })

    {
      const ai = await program.account.config.fetchNullable(configPda);
      console.log("configPda info", ai, deployer.toBase58())
    }

    // const ownerKey = anchor.web3.Keypair.generate();
    // await program.rpc.transferOwner(ownerKey.publicKey, {
    //   accounts: {
    //     config: configPda,
    //     owner: deployer,
    //   },
    //   signers: [signer],
    // })

    // const vaultAccount = await getAssociatedTokenAddressSync(mintAccount, program.programId)
    const [vaultAccount, vaultBump] = await anchor.web3.PublicKey.findProgramAddress([mintAccount.toBuffer()], programId);
    console.log("vaultAccount", vaultAccount.toBase58(),)

    const res = await program.rpc.addAsset({
      accounts: {
        config: configPda,
        mintAccount,
        owner: deployer,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        vaultAccount,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
      signers: [signer],
    })

    {
      const ai = await program.account.config.fetchNullable(configPda);
      console.log("configPda info", ai)
    }

    const [userKey, userBump] = await anchor.web3.PublicKey.findProgramAddress([mintAccount.toBuffer(), deployer.toBuffer()], programId);
    console.log("userKey", userKey.toBase58())
    const amount = new anchor.BN(40);
    const accounts = {
      config: configPda,
      user: userKey,
      payer: signer.publicKey,
      mintAccount,
      vaultAccount,
      userTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }
    // console.log("accounts", program.account)
    await program.rpc.deposit(amount, {
      accounts,
      instructions: [
        // await program.account.userInfo.createInstruction(userKey, 1024),
      ],
      signers: [signer],
    })
    {
      const ai = await program.account.userInfo.fetchNullable(userKey);
      console.log("deposit info", ai)
    }

    await program.rpc.withdraw(amount, {
      accounts: {
        config: configPda,
        user: userKey,
        payer: signer.publicKey,
        mintAccount,
        vaultAccount,
        userTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      },
      signers: [signer],
    })

  });
});
