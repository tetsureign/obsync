use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "obsync", about = "Obsidian vault sync CLI")]
struct Cli {
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
async fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::Vault { action } => println!("vault command: todo"),
        Commands::Sync { vault_id } => println!("sync {vault_id}: todo"),
    }
}
