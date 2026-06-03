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
        Commands::Vault { action } => match action {
            VaultCommands::List => println!("list vaults: todo"),
            VaultCommands::Add { name, path, remote } => {
                println!("add vault: name={name}, path={path}, remote={remote}: todo")
            }
        },
        Commands::Sync { vault_id } => println!("sync {vault_id}: todo"),
    }
}
