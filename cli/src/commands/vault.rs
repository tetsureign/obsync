use anyhow::{Context, Result};
use normpath::PathExt;
use std::path::Path;

use crate::cli::VaultCommands;
use crate::client::{ApiClient, CreateVaultRequest};
use crate::output;

pub(crate) async fn run(api: &ApiClient, action: VaultCommands) -> Result<()> {
    match action {
        VaultCommands::List => list(api).await,
        VaultCommands::Add { name, path } => add(api, name, path).await,
    }
}

async fn list(api: &ApiClient) -> Result<()> {
    let vaults = api.list_vaults().await?;
    output::print_vaults(&vaults);
    Ok(())
}

async fn add(api: &ApiClient, name: Option<String>, path: String) -> Result<()> {
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

    output::print_vault_added(&vault);
    Ok(())
}
