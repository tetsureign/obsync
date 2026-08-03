use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Vault {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) local_path: String,
    pub(crate) auto_sync: bool,
    pub(crate) sync_interval: u64,
    pub(crate) conflict_strategy: String,
    pub(crate) is_dirty: bool,
    pub(crate) last_synced_at: Option<String>,
    pub(crate) created_at: String,
    pub(crate) updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CreateVaultRequest {
    pub(crate) local_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) auto_sync: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) sync_interval: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) conflict_strategy: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EditVaultRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) local_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) auto_sync: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) sync_interval: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) conflict_strategy: Option<String>,
}

#[derive(Debug, Serialize, Default)]
pub(super) struct SyncVaultBody {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) file_paths: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) commit_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SyncOperation {
    pub(crate) id: String,
    pub(crate) vault_id: String,
    pub(crate) status: String,
    pub(crate) step: String,
    pub(crate) error: Option<String>,
    pub(crate) commit_sha: Option<String>,
    pub(crate) started_at: String,
    pub(crate) created_at: String,
    pub(crate) updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CompletedSyncOperation {
    pub(crate) id: String,
    pub(crate) vault_id: String,
    pub(crate) status: String,
    pub(crate) step: String,
    pub(crate) error: Option<String>,
    pub(crate) commit_sha: Option<String>,
    pub(crate) started_at: String,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SyncRuntimeStatus {
    pub(crate) has_in_memory_work: bool,
    pub(crate) queued_count: usize,
    pub(crate) running_count: usize,
    pub(crate) running_tasks: Vec<SyncQueueRunningTask>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SyncStatusResponse {
    pub(crate) active_operations: Option<CompletedSyncOperation>,
    pub(crate) recent_operations: Vec<CompletedSyncOperation>,
    pub(crate) runtime: SyncRuntimeStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SyncQueueRunningTask {
    pub(crate) id: Option<String>,
    pub(crate) priority: u64,
    pub(crate) start_time: u64,
    pub(crate) timeout: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub(crate) struct HealthResponse {
    pub(crate) status: String,
}
