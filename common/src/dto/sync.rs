use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Default)]
pub struct SyncVaultBody {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_paths: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub commit_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncOperation {
    pub id: String,
    pub vault_id: String,
    pub status: String,
    pub step: String,
    pub error: Option<String>,
    pub commit_sha: Option<String>,
    pub started_at: String,
    pub created_at: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletedSyncOperation {
    pub id: String,
    pub vault_id: String,
    pub status: String,
    pub step: String,
    pub error: Option<String>,
    pub commit_sha: Option<String>,
    pub started_at: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncRuntimeStatus {
    pub has_in_memory_work: bool,
    pub queued_count: usize,
    pub running_count: usize,
    pub running_tasks: Vec<SyncQueueRunningTask>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatusResponse {
    pub active_operations: Option<CompletedSyncOperation>,
    pub recent_operations: Vec<CompletedSyncOperation>,
    pub runtime: SyncRuntimeStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncQueueRunningTask {
    pub id: Option<String>,
    pub priority: u64,
    pub start_time: i64,
    pub timeout: Option<u64>,
}
