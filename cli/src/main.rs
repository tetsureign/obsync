mod client;

use anyhow::Result;
use clap::{Parser, Subcommand};
use client::{ApiClient, CreateVaultRequest, DaemonError};

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
        /// Vault ID to sync
        vault_id: String,
    },
}

#[derive(Subcommand)]
enum VaultCommands {
    List,
    Add {
        name: String,
        path: String,
        remote: String,
    },
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
            VaultCommands::Add { name, path, remote } => {
                let req = CreateVaultRequest {
                    name,
                    local_path: path,
                    remote,
                    branch: None,
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
        Commands::Sync { vault_id } => match api.get_vault(&vault_id).await {
            Ok(vault) => {
                println!("Syncing vault '{}' (ID: {})...", vault.name, vault.id);
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
