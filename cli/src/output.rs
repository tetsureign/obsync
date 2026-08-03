use crate::{
    client::{CompletedSyncOperation, SyncOperation, SyncStatusResponse, Vault},
    utils::{format_datetime_rfc3339, format_datetime_unix_millis},
};

pub(crate) fn print_vault(vault: &Vault) {
    println!("Vault: {}", vault.name);
    println!("  Local Path: {}", vault.local_path);
    println!("  Auto Sync: {}", vault.auto_sync);
    println!("  Sync Interval: {} seconds", vault.sync_interval);
    println!("  Conflict Strategy: {}", vault.conflict_strategy);
}

pub(crate) fn print_vaults(vaults: &[Vault]) {
    if vaults.is_empty() {
        println!("No vaults configured.");
    } else {
        println!("Vaults (total {}):", vaults.len());
        for vault in vaults {
            println!("  • {} -> {}", vault.name, vault.local_path);
        }
    }
}

pub(crate) fn print_vault_added(vault: &Vault) {
    println!("✅ Added vault '{}' with ID: {}", vault.name, vault.id);
}

pub(crate) fn print_sync_started(operation: &SyncOperation) {
    println!(
        "✅ Sync operation '{}' started [status: {}, step: {}]",
        operation.id, operation.status, operation.step
    );
}

pub(crate) fn print_sync_status(status: &SyncStatusResponse) {
    println!("Sync Status");
    if status.runtime.has_in_memory_work {
        println!("  In-Memory Work: Yes");
        println!("  Queued Count: {}", status.runtime.queued_count);
        println!("  Running Count: {}", status.runtime.running_count);
        println!("  Running Tasks:");
        for task in &status.runtime.running_tasks {
            let start_time_str = format_datetime_unix_millis(task.start_time)
                .unwrap_or_else(|_| task.start_time.to_string());
            println!(
                "    • ID: {} [priority: {}, start time: {}, timeout: {:?}]",
                task.id.as_deref().unwrap_or("None"),
                task.priority,
                start_time_str,
                task.timeout.unwrap_or(0)
            );
        }
    }
    if status.active_operations.is_some() {
        println!("  Active Sync Operations:");
        if let Some(op) = &status.active_operations {
            print_operation_entry(op);
        }
    }
    println!("  Recent Sync Operations:");
    for op in &status.recent_operations {
        print_operation_entry(op);
    }
}

fn print_operation_entry(operation: &CompletedSyncOperation) {
    let updated_at_str = format_datetime_rfc3339(&operation.updated_at)
        .unwrap_or_else(|_| operation.updated_at.clone());

    if operation.error.is_some() {
        println!(
            "    • {} [status: {}, step: {}, error: {}, commit SHA: {}]",
            updated_at_str,
            operation.status,
            operation.step,
            operation.error.as_deref().unwrap_or("N/A"),
            operation.commit_sha.as_deref().unwrap_or("N/A")
        );
    } else {
        println!(
            "    • {} [status: {}, step: {}, commit SHA: {}]",
            updated_at_str,
            operation.status,
            operation.step,
            operation.commit_sha.as_deref().unwrap_or("N/A")
        );
    }
}
