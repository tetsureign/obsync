mod error;
mod models;

pub(crate) use error::DaemonError;
pub(crate) use models::{CreateVaultRequest, EditVaultRequest, SyncOperation, Vault};

use anyhow::{Context, Result};
use reqwest::{Client, Response};
use serde::de::DeserializeOwned;
use std::time::Duration;

use models::SyncVaultBody;

#[derive(Clone, Debug)]
pub(crate) struct ApiClient {
    client: Client,
    base_url: String,
}

impl ApiClient {
    /// Creates a new `ApiClient` instance configured with a connection timeout.
    pub(crate) fn new(base_url: impl Into<String>) -> Result<Self> {
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
    pub(crate) async fn health_check(&self) -> bool {
        let url = format!("{}/health", self.base_url);
        match self.client.get(&url).send().await {
            Ok(resp) => resp.status().is_success(),
            Err(_) => false,
        }
    }

    /// Helper to process HTTP responses and parse domain errors when status is not 2xx.
    async fn handle_response<T: DeserializeOwned>(
        &self,
        response: Response,
    ) -> Result<T, DaemonError> {
        let status = response.status();

        if status.is_success() {
            response.json::<T>().await.map_err(DaemonError::Network)
        } else {
            match response.json::<error::ApiErrorPayload>().await {
                Ok(payload) => Err(DaemonError::Api(payload)),
                Err(_) => Err(DaemonError::Api(error::ApiErrorPayload {
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
    pub(crate) async fn list_vaults(&self) -> Result<Vec<Vault>, DaemonError> {
        let url = format!("{}/vaults", self.base_url);
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(DaemonError::Network)?;

        self.handle_response(resp).await
    }

    /// Fetch a single vault by name (`GET /vaults/:name`).
    #[allow(dead_code)]
    pub(crate) async fn get_vault(&self, name: &str) -> Result<Vault, DaemonError> {
        let url = format!("{}/vaults/{}", self.base_url, name);
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(DaemonError::Network)?;

        self.handle_response(resp).await
    }

    /// Add a new vault (`POST /vaults`).
    pub(crate) async fn add_vault(&self, req: CreateVaultRequest) -> Result<Vault, DaemonError> {
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

    /// Edit an existing vault by name (`PUT /vaults/:name`).
    pub(crate) async fn edit_vault(
        &self,
        name: &str,
        req: EditVaultRequest,
    ) -> Result<Vault, DaemonError> {
        let url = format!("{}/vaults/{}", self.base_url, name);
        let resp = self
            .client
            .put(&url)
            .json(&req)
            .send()
            .await
            .map_err(DaemonError::Network)?;

        self.handle_response(resp).await
    }

    /// Delete a vault by name (`DELETE /vaults/:name`).
    pub(crate) async fn delete_vault(&self, name: &str) -> Result<bool, DaemonError> {
        let url = format!("{}/vaults/{}", self.base_url, name);
        let resp = self
            .client
            .delete(&url)
            .send()
            .await
            .map_err(DaemonError::Network)?;

        self.handle_response(resp).await
    }

    /// Trigger a sync for a vault by name (`POST /vaults/:name/sync`).
    pub(crate) async fn trigger_sync(
        &self,
        name: &str,
        file_paths: Option<Vec<String>>,
        commit_message: Option<String>,
    ) -> Result<SyncOperation, DaemonError> {
        let url = format!("{}/vaults/{}/sync", self.base_url, name);
        let body = SyncVaultBody {
            file_paths,
            commit_message,
        };
        let resp = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(DaemonError::Network)?;

        self.handle_response(resp).await
    }
}
