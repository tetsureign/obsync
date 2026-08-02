use anyhow::Result;

use crate::cli::SyncArgs;
use crate::client::ApiClient;
use crate::output;

pub(crate) async fn run(api: &ApiClient, args: SyncArgs) -> Result<()> {
    let operation = api
        .trigger_sync(&args.name, args.file_paths, args.commit_message)
        .await?;

    output::print_sync_started(&operation);
    Ok(())
}
