use crate::client::{SyncOperation, Vault};

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
