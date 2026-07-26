mod client;

use anyhow::Result;
use clap::{Args, Parser, Subcommand};
use client::{ApiClient, CreateVaultRequest, DaemonError};
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
    let cli = Cli::parse();
    let api = ApiClient::new(&cli.daemon_url)?;

    if !api.health_check().await {
        eprintln!("⚠️  Could not reach daemon at {}", cli.daemon_url);
    }

    match cli.command {
        Commands::Vault { action } => match action {
            VaultCommands::List => match api.list_vaults().await {
                Ok(vaults) => {
                    if vaults.is_empty() {
                        println!("No vaults configured.");
                    } else {
                        println!("Vaults (total {}):", vaults.len());
                        for v in vaults {
                            println!("  • {} [{}] -> {}", v.name, v.id, v.local_path);
                        }
                    }
                }
                Err(err) => handle_daemon_error(err),
            },
            VaultCommands::Add { name, path } => {
                let req = CreateVaultRequest {
                    local_path: Path::new(&path)
                        .normalize()
                        .unwrap()
                        .as_path()
                        .to_string_lossy()
                        .into_owned(),
                    name: name,
                    auto_sync: None,
                    sync_interval: None,
                    conflict_strategy: None,
                };
                match api.add_vault(req).await {
                    Ok(vault) => {
                        println!("✅ Added vault '{}' with ID: {}", vault.name, vault.id);
                    }
                    Err(err) => handle_daemon_error(err),
                }
            }
        },
        Commands::Sync { args } => match api
            .trigger_sync(&args.name, args.file_paths, args.commit_message)
            .await
        {
            Ok(op) => {
                println!("✅ Sync operation '{}' started [status: {}, step:{}]", op.id, op.status, op.step);
            }
            Err(err) => handle_daemon_error(err),
        },
    }

    Ok(())
}

fn handle_daemon_error(err: DaemonError) {
    match err {
        DaemonError::Api(api_err) => {
            eprintln!("❌ {}", api_err.message);
        }
        DaemonError::Network(net_err) => {
            eprintln!("🌐 Network error: {net_err}");
        }
        DaemonError::Other(other_err) => {
            eprintln!("❌ Error: {other_err}");
        }
    }
}
