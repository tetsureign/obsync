use anyhow::Result;

use crate::cli::VaultCommands;
use crate::client::{ApiClient, CreateVaultRequest, EditVaultRequest};
use crate::output;
use crate::utils::normalize_path;

pub(crate) async fn run(api: &ApiClient, action: VaultCommands) -> Result<()> {
    match action {
        VaultCommands::List => list(api).await,
        VaultCommands::Add {
            name,
            path,
            auto_sync,
            sync_interval,
            conflict_strategy,
        } => add(api, name, path, auto_sync, sync_interval, conflict_strategy).await,
        VaultCommands::Info { name } => get(api, name).await,
        VaultCommands::Delete { name } => delete(api, name).await,
        VaultCommands::Edit {
            name,
            new_name,
            new_path,
            auto_sync,
            sync_interval,
            conflict_strategy,
        } => {
            edit(
                api,
                name,
                new_name,
                new_path,
                auto_sync,
                sync_interval,
                conflict_strategy,
            )
            .await
        }
    }
}

async fn list(api: &ApiClient) -> Result<()> {
    let vaults = api.list_vaults().await?;
    output::print_vaults(&vaults);
    Ok(())
}

async fn add(
    api: &ApiClient,
    name: Option<String>,
    path: String,
    auto_sync: Option<bool>,
    sync_interval: Option<u64>,
    conflict_strategy: Option<String>,
) -> Result<()> {
    let local_path = normalize_path(&path)?;

    let vault = api
        .add_vault(CreateVaultRequest {
            local_path,
            name,
            auto_sync,
            sync_interval,
            conflict_strategy,
        })
        .await?;

    output::print_vault_added(&vault);
    Ok(())
}

async fn get(api: &ApiClient, name: String) -> Result<()> {
    let vault = api.get_vault(&name).await?;
    output::print_vault(&vault);
    Ok(())
}

async fn delete(api: &ApiClient, name: String) -> Result<()> {
    let success = api.delete_vault(&name).await?;
    if success {
        println!("✅ Deleted vault '{}'", name);
    } else {
        println!("⚠️ Vault '{}' not found", name);
    }
    Ok(())
}

async fn edit(
    api: &ApiClient,
    name: String,
    new_name: Option<String>,
    new_path: Option<String>,
    auto_sync: Option<bool>,
    sync_interval: Option<u64>,
    conflict_strategy: Option<String>,
) -> Result<()> {
    let local_path = if let Some(path) = new_path {
        Some(normalize_path(&path)?)
    } else {
        None
    };

    if new_name.is_none()
        && local_path.is_none()
        && auto_sync.is_none()
        && sync_interval.is_none()
        && conflict_strategy.is_none()
    {
        println!("⚠️ No changes specified for vault '{}'", name);
        return Ok(());
    }

    let vault = api
        .edit_vault(
            &name,
            EditVaultRequest {
                local_path,
                name: new_name,
                auto_sync,
                sync_interval,
                conflict_strategy,
            },
        )
        .await?;
    output::print_vault(&vault);
    Ok(())
}
