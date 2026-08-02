use clap::{Args, Parser, Subcommand};

#[derive(Parser)]
#[command(name = "obsync", about = "Obsidian vault sync CLI")]
pub(crate) struct Cli {
    /// Base URL for the obsync daemon
    #[arg(
        long,
        env = "OBSYNC_DAEMON_URL",
        default_value = "http://127.0.0.1:3000"
    )]
    pub(crate) daemon_url: String,

    #[command(subcommand)]
    pub(crate) command: Commands,
}

#[derive(Subcommand)]
pub(crate) enum Commands {
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
pub(crate) enum VaultCommands {
    List,
    Add {
        path: String,
        #[arg(short, long)]
        name: Option<String>,
    },
}

#[derive(Args)]
pub(crate) struct SyncArgs {
    pub(crate) name: String,
    #[arg(short, long, num_args = 1..)]
    pub(crate) file_paths: Option<Vec<String>>,
    #[arg(short, long)]
    pub(crate) commit_message: Option<String>,
}
