use anyhow::{Context, Result};
use normpath::PathExt;
use std::path::Path;

pub(crate) fn normalize_path(path: impl AsRef<Path>) -> Result<String> {
    path.as_ref()
        .normalize()
        .context("failed to normalize path")
        .map(|p| p.as_path().to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_path_current_dir() {
        let normalized = normalize_path(".").unwrap();
        assert!(!normalized.is_empty());
        assert!(Path::new(&normalized).is_absolute());
    }
}
