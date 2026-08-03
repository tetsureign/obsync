use anyhow::{Result, bail};

use crate::cli::{SyncAction, SyncArgs};
use crate::client::ApiClient;
use crate::output;

pub(crate) async fn run(api: &ApiClient, args: SyncArgs) -> Result<()> {
    match args.action {
        Some(SyncAction::Status {
            name,
            recent_sync_limit,
        }) => {
            let status = api.get_sync_status(&name, recent_sync_limit).await?;
            output::print_sync_status(&status);
            Ok(())
        }
        None => {
            let Some(name) = args.name else {
                bail!(
                    "Vault name is required. Usage: obsync sync <name> or obsync sync status <name>"
                );
            };

            let operation = api
                .trigger_sync(&name, args.file_paths, args.commit_message)
                .await?;

            output::print_sync_started(&operation);
            Ok(())
        }
    }
}
