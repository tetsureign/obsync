use crate::client::{CompletedSyncOperation, SyncOperation, SyncStatusResponse, Vault};

pub(crate) fn print_vault(vault: &Vault) {
    println!("Vault: {} [{}]", vault.name, vault.id);
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
            println!("  • {} [{}] -> {}", vault.name, vault.id, vault.local_path);
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
            println!(
                "    • {:?} [priority: {}, start time: {}, timeout: {:?}]",
                task.id, task.priority, task.start_time, task.timeout
            );
        }
    }
    if !status.active_operations.is_none() {
        println!("  Active Sync Operations:");
        while let Some(op) = &status.active_operations {
            print_operation_entry(op);
        }
    }
    println!("  Recent Sync Operations:");
    for op in &status.recent_operations {
        print_operation_entry(op);
    }
}

fn print_operation_entry(operation: &CompletedSyncOperation) {
    if operation.error.is_some() {
        println!(
            "    • {:#?} [status: {}, step: {}, error: {}, commit SHA: {}]",
            operation.updated_at,
            operation.status,
            operation.step,
            operation.error.as_deref().unwrap_or("N/A"),
            operation.commit_sha.as_deref().unwrap_or("N/A")
        );
    } else {
        println!(
            "    • {:#?} [status: {}, step: {}, commit SHA: {}]",
            operation.updated_at,
            operation.status,
            operation.step,
            operation.commit_sha.as_deref().unwrap_or("N/A")
        );
    }
}
