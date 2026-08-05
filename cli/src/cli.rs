use clap::{Args, Parser, Subcommand};

#[derive(Parser)]
#[command(name = "obsync", about = "Obsidian vault sync CLI")]
pub(crate) struct Cli {
    /// Base URL for the obsync daemon
    #[arg(
        long,
        env = "OBSYNC_DAEMON_URL",
        default_value = "http://127.0.0.1:7274"
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
        #[arg(short, long)]
        auto_sync: Option<bool>,
        #[arg(short = 'i', long)]
        sync_interval: Option<u64>,
        #[arg(short, long)]
        conflict_strategy: Option<String>,
    },
    Info {
        name: String,
    },
    Delete {
        name: String,
    },
    Edit {
        name: String,
        #[arg(short = 'n', long)]
        new_name: Option<String>,
        #[arg(short = 'p', long)]
        new_path: Option<String>,
        #[arg(short, long)]
        auto_sync: Option<bool>,
        #[arg(short = 'i', long)]
        sync_interval: Option<u64>,
        #[arg(short, long)]
        conflict_strategy: Option<String>,
    },
}

#[derive(Args)]
pub(crate) struct SyncArgs {
    #[command(subcommand)]
    pub(crate) action: Option<SyncAction>,

    /// Vault name (required when triggering a sync directly)
    pub(crate) name: Option<String>,
    #[arg(short, long, num_args = 1..)]
    pub(crate) file_paths: Option<Vec<String>>,
    #[arg(short, long)]
    pub(crate) commit_message: Option<String>,
}

#[derive(Subcommand)]
pub(crate) enum SyncAction {
    Status {
        name: String,
        #[arg(short, long)]
        recent_sync_limit: Option<u32>,
    },
}
