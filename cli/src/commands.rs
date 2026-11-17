mod sync;
mod vault;

use anyhow::Result;

use crate::cli::Commands;
use crate::client::ApiClient;

pub(crate) async fn run(api: &ApiClient, command: Commands) -> Result<()> {
    match command {
        Commands::Vault { action } => vault::run(api, action).await,
        Commands::Sync { args } => sync::run(api, args).await,
    }
}
