use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount},
};
use solana_program::pubkey;
// use spl_associated_token_account;

declare_id!("AtjBMK1fjoXw3sBiMBJkyStuPT1S87DU1mMvmGanN3hq");


#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient Fund")]
    InsufficientFund,
    #[msg("Invalid Amount")]
    InvalidAmount,

    #[msg("Asset Existed")]
    AssetExisted,

    #[msg("Asset Not Found")]
    AssetNotFound,

    #[msg("Owner Only")]
    OwnerOnly,
}

#[program]
pub mod aa {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, owner: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.assets = Vec::new();
        config.bumps = Vec::new();
        config.owner = owner;
        msg!("initialize {}", config.owner);
        Ok(())
    }

    pub fn transfer_owner(ctx: Context<TransferOwner>, new_owner: Pubkey) -> Result<()> {
        let config: &mut Account<'_, Config> = &mut ctx.accounts.config;
        msg!("transfer_owner auth {} {}", config.owner, ctx.accounts.owner.key());
        require_eq!(config.owner, ctx.accounts.owner.key(), ErrorCode::OwnerOnly);
        config.owner = new_owner;
        Ok(())
    }

    pub fn add_asset(ctx: Context<AddAsset>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require_eq!(config.owner, ctx.accounts.owner.key(), ErrorCode::OwnerOnly);
        let mint_account_key = ctx.accounts.mint_account.key();
        require!(
            !config.assets.contains(&mint_account_key),
            ErrorCode::AssetExisted
        );

        let (config_pda, bump) = Pubkey::find_program_address(&[mint_account_key.as_ref()], &ctx.program_id);
        require!(
            config_pda == ctx.accounts.vault_account.key(),
            ErrorCode::InvalidAmount
        );
        ctx.accounts.config.assets.push(mint_account_key);
        ctx.accounts.config.bumps.push(bump);
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require_neq!(amount, 0, ErrorCode::InvalidAmount);

        let config = &ctx.accounts.config;
        msg!("mint {}", ctx.accounts.mint_account.key().clone());
        require!(
            config.assets.contains(&ctx.accounts.mint_account.key()),
            ErrorCode::AssetNotFound
        );

        let user = &mut ctx.accounts.user;
        // let vault_account =
        //     spl_associated_token_account::get_associated_token_address(ctx.program_id, &mint_account.key());
        let cpi_ctx = CpiContext::new(
            ctx.accounts.mint_account.to_account_info(),
            token::Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.vault_account.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, amount)?;
        user.balance += amount;
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require_neq!(amount, 0, ErrorCode::InvalidAmount);
        let config = &ctx.accounts.config;
        let pos = config.assets.iter().position(|elm| elm == &ctx.accounts.mint_account.key());
        require!(pos.is_some(), ErrorCode::AssetNotFound);
        let bump = config.bumps[pos.unwrap()];
        let user: &mut Account<'_, UserInfo> = &mut ctx.accounts.user;
        msg!("withdraw user balance {} {}", user.balance, ctx.accounts.vault_account.amount);
        require_gte!(user.balance, amount, ErrorCode::InsufficientFund);

        let mint_account_key = ctx.accounts.mint_account.key();
        let seeds = vec![bump];
        let seeds = vec![mint_account_key.as_ref(), seeds.as_slice()];
        let seeds = vec![seeds.as_slice()];
        let signer_seeds = seeds.as_slice();
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.mint_account.to_account_info(),
            token::Transfer {
                from: ctx.accounts.vault_account.to_account_info(),
                authority: ctx.accounts.vault_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
            },
            signer_seeds,
        );
        user.balance -= amount;
        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}

#[account]
#[derive(Default)]
pub struct Config {
    owner: Pubkey,
    assets: Vec<Pubkey>,
    bumps: Vec<u8>,
}

#[account]
#[derive(Default)]
pub struct UserInfo {
    mint: Pubkey,
    balance: u64,
    bump: u8,
}

// impl Space for UserInfo {
//     const INIT_SPACE: usize = 8 + 8 + 32 + 32 + 8 + 1;
// }

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer=owner,
        seeds = [
            b"config",
        ],
        bump,
        space = 1024,
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferOwner<'info> {
    #[account(mut)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
// #[instruction(bump: u8)]
pub struct AddAsset<'info> {
    #[account(
        mut, 
        seeds = [
            b"config",
        ],
        bump
    )]
    config: Account<'info, Config>,
    mint_account: Account<'info, Mint>,
    #[account(init,
        payer = owner, 
        // associated_token::mint = mint_account,
        // associated_token::authority = p,
        seeds = [mint_account.key().as_ref()],
        bump,
        token::mint = mint_account,
        token::authority = vault_account,
    )]
    pub vault_account: Account<'info, TokenAccount>,

    #[account(mut)]
    owner: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        seeds = [
            b"config",
        ], 
        bump
    )]
    pub config: Account<'info, Config>,
    #[account(
        init_if_needed,
        payer = payer,
        seeds = [
            mint_account.key().as_ref(),
            payer.key().as_ref(),
        ],
        bump,
        space = 1024,
    )]
    pub user: Account<'info, UserInfo>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault_account: Account<'info, TokenAccount>,
    pub mint_account: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        seeds = [
            b"config",
        ],
        bump
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub user: Account<'info, UserInfo>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, 
        token::mint = mint_account,
        token::authority = vault_account,
    )]
    pub vault_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub mint_account: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
