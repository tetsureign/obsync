use serde::Deserialize;

pub mod sync;
pub mod vault;

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct HealthResponse {
    pub status: String,
}
