use anyhow::{Context, Result};
use reqwest::{Client, Response};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::time::Duration;

// ============================================================================
// DTOs
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vault {
    pub id: String,
    pub name: String,
    pub local_path: String,
    pub auto_sync: bool,
    pub sync_interval: u64,
    pub conflict_strategy: String,
    pub is_dirty: bool,
    pub last_synced_at: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVaultRequest {
    pub local_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_sync: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sync_interval: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conflict_strategy: Option<String>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct HealthResponse {
    pub status: String,
}

// ============================================================================
// Error Payload & Domain Error Types
// ============================================================================

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct ApiErrorPayload {
    pub status_code: u16,
    pub code: String,
    pub message: String,
    pub timestamp: Option<String>,
    pub path: Option<String>,
    pub details: Option<serde_json::Value>,
}

#[derive(Debug)]
pub enum DaemonError {
    /// Domain error returned by daemon (e.g. code: "VAULT_NOT_FOUND")
    Api(ApiErrorPayload),
    /// Low-level HTTP or network transport failure
    Network(reqwest::Error),
    /// Custom unexpected error
    #[allow(dead_code)]
    Other(anyhow::Error),
}

impl fmt::Display for DaemonError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DaemonError::Api(payload) => {
                write!(f, "[{}] {}", payload.code, payload.message)
            }
            DaemonError::Network(err) => write!(f, "Network error: {}", err),
            DaemonError::Other(err) => write!(f, "Error: {}", err),
        }
    }
}

impl std::error::Error for DaemonError {}

// ============================================================================
// API Client Implementation
// ============================================================================

#[derive(Clone, Debug)]
pub struct ApiClient {
    client: Client,
    base_url: String,
}

impl ApiClient {
    /// Creates a new `ApiClient` instance configured with a connection timeout.
    pub fn new(base_url: impl Into<String>) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .context("Failed to build HTTP client")?;

        Ok(Self {
            client,
            base_url: base_url.into().trim_end_matches('/').to_string(),
        })
    }

    /// Health probe to check if the daemon is running (`GET /health`).
    pub async fn health_check(&self) -> bool {
        let url = format!("{}/health", self.base_url);
        match self.client.get(&url).send().await {
            Ok(resp) => resp.status().is_success(),
            Err(_) => false,
        }
    }

    /// Helper to process HTTP responses and parse domain errors when status is not 2xx.
    async fn handle_response<T: for<'de> Deserialize<'de>>(
        &self,
        response: Response,
    ) -> Result<T, DaemonError> {
        let status = response.status();

        if status.is_success() {
            response.json::<T>().await.map_err(DaemonError::Network)
        } else {
            match response.json::<ApiErrorPayload>().await {
                Ok(payload) => Err(DaemonError::Api(payload)),
                Err(_) => Err(DaemonError::Api(ApiErrorPayload {
                    status_code: status.as_u16(),
                    code: "HTTP_ERROR".to_string(),
                    message: format!("HTTP Error {}", status),
                    timestamp: None,
                    path: None,
                    details: None,
                })),
            }
        }
    }

    /// Fetch all registered vaults (`GET /vaults`).
    pub async fn list_vaults(&self) -> Result<Vec<Vault>, DaemonError> {
        let url = format!("{}/vaults", self.base_url);
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(DaemonError::Network)?;

        self.handle_response(resp).await
    }

    /// Fetch a single vault by ID (`GET /vaults/:id`).
    pub async fn get_vault(&self, id: &str) -> Result<Vault, DaemonError> {
        let url = format!("{}/vaults/{}", self.base_url, id);
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(DaemonError::Network)?;

        self.handle_response(resp).await
    }

    /// Add a new vault (`POST /vaults`).
    pub async fn add_vault(&self, req: CreateVaultRequest) -> Result<Vault, DaemonError> {
        let url = format!("{}/vaults", self.base_url);
        let resp = self
            .client
            .post(&url)
            .json(&req)
            .send()
            .await
            .map_err(DaemonError::Network)?;

        self.handle_response(resp).await
    }

    /// Delete a vault by ID (`DELETE /vaults/:id`).
    #[allow(dead_code)]
    pub async fn delete_vault(&self, id: &str) -> Result<bool, DaemonError> {
        let url = format!("{}/vaults/{}", self.base_url, id);
        let resp = self
            .client
            .delete(&url)
            .send()
            .await
            .map_err(DaemonError::Network)?;

        self.handle_response(resp).await
    }
}
