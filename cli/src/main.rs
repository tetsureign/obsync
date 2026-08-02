mod client;

use anyhow::{Context, Result};
use clap::{Args, Parser, Subcommand};
use client::{ApiClient, CreateVaultRequest};
use normpath::PathExt;
use std::path::Path;

#[derive(Parser)]
#[command(name = "obsync", about = "Obsidian vault sync CLI")]
struct Cli {
    /// Base URL for the obsync daemon
    #[arg(
        long,
        env = "OBSYNC_DAEMON_URL",
        default_value = "http://127.0.0.1:3000"
    )]
    daemon_url: String,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Vault {
        #[command(subcommand)]
        action: VaultCommands,
    },
    Sync {
        #[command(flatten)]
        args: SyncArgs,
    },
}

#[derive(Subcommand)]
enum VaultCommands {
    List,
    Add {
        path: String,
        #[arg(short, long)]
        name: Option<String>,
    },
}

#[derive(Args)]
struct SyncArgs {
    name: String,
    #[arg(short, long, num_args = 1..)]
    file_paths: Option<Vec<String>>,
    #[arg(short, long)]
    commit_message: Option<String>,
}

#[tokio::main]
async fn main() -> Result<()> {
    run(Cli::parse()).await
}

async fn run(cli: Cli) -> Result<()> {
    let api = ApiClient::new(&cli.daemon_url)?;

    if !api.health_check().await {
        eprintln!("⚠️  Could not reach daemon at {}", cli.daemon_url);
    }

    match cli.command {
        Commands::Vault { action } => match action {
            VaultCommands::List => {
                let vaults = api.list_vaults().await?;

                if vaults.is_empty() {
                    println!("No vaults configured.");
                } else {
                    println!("Vaults (total {}):", vaults.len());
                    for v in vaults {
                        println!("  • {} [{}] -> {}", v.name, v.id, v.local_path);
                    }
                }
            }
            VaultCommands::Add { name, path } => {
                let local_path = Path::new(&path)
                    .normalize()
                    .context("failed to normalize vault path")?
                    .as_path()
                    .to_string_lossy()
                    .into_owned();

                let vault = api
                    .add_vault(CreateVaultRequest {
                        local_path,
                        name,
                        auto_sync: None,
                        sync_interval: None,
                        conflict_strategy: None,
                    })
                    .await?;

                println!("✅ Added vault '{}' with ID: {}", vault.name, vault.id);
            }
        },
        Commands::Sync { args } => {
            let op = api
                .trigger_sync(&args.name, args.file_paths, args.commit_message)
                .await?;

            println!(
                "✅ Sync operation '{}' started [status: {}, step: {}]",
                op.id, op.status, op.step
            );
        }
    }

    Ok(())
}
