use anyhow::{Context, Result};
use chrono::{DateTime, Local};
use normpath::PathExt;
use std::path::Path;

pub(crate) fn normalize_path(path: impl AsRef<Path>) -> Result<String> {
    path.as_ref()
        .normalize()
        .context("failed to normalize path")
        .map(|p| p.as_path().to_string_lossy().into_owned())
}

pub(crate) fn format_datetime_rfc3339(datetime_str: &str) -> Result<String> {
    DateTime::parse_from_rfc3339(datetime_str)
        .context("failed to parse rfc3339 datetime")
        .map(|dt| {
            dt.with_timezone(&Local)
                .format("%d/%m/%Y %H:%M")
                .to_string()
        })
}

pub(crate) fn format_datetime_unix_millis(timestamp: i64) -> Result<String> {
    DateTime::from_timestamp_millis(timestamp)
        .context("invalid timestamp millis")
        .map(|dt| {
            dt.with_timezone(&Local)
                .format("%d/%m/%Y %H:%M")
                .to_string()
        })
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

    #[test]
    fn test_format_datetime_rfc3339() {
        let formatted = format_datetime_rfc3339("2023-10-01T12:00:00Z").unwrap();
        assert!(formatted.starts_with("01/10/2023"));
    }

    #[test]
    fn test_format_datetime_rfc3339_invalid() {
        assert!(format_datetime_rfc3339("invalid-date").is_err());
    }

    #[test]
    fn test_format_datetime_unix_millis() {
        let formatted = format_datetime_unix_millis(1696161600000).unwrap();
        assert!(!formatted.is_empty());
    }

    #[test]
    fn test_format_datetime_unix_millis_invalid() {
        assert!(format_datetime_unix_millis(i64::MAX).is_err());
    }
}
