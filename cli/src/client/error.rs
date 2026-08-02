use anyhow::Error;
use serde::Deserialize;
use std::fmt;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub(crate) struct ApiErrorPayload {
    pub(crate) status_code: u16,
    pub(crate) code: String,
    pub(crate) message: String,
    pub(crate) timestamp: Option<String>,
    pub(crate) path: Option<String>,
    pub(crate) details: Option<serde_json::Value>,
}

#[derive(Debug)]
pub(crate) enum DaemonError {
    /// Domain error returned by daemon (e.g. code: "VAULT_NOT_FOUND")
    Api(ApiErrorPayload),
    /// Low-level HTTP or network transport failure
    Network(reqwest::Error),
    /// Custom unexpected error
    #[allow(dead_code)]
    Other(Error),
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
