use std::path::Path;

use crate::cli::{Result, AppError};

#[derive(Clone)]
pub struct Model {
    pub name: String,
    pub model_type: String,
    pub path: String,
    pub parameters: Option<usize>,
}

impl Model {
    pub fn load(path: &Path) -> Result<Self> {
        let path_str = path.to_string_lossy().to_string();

        if !path.exists() {
            return Err(AppError(format!("Model path does not exist: {}", path_str)));
        }

        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let model_type = if path.is_dir() {
            "directory".to_string()
        } else {
            path.extension()
                .and_then(|e| e.to_str())
                .unwrap_or("unknown")
                .to_string()
        };

        Ok(Self {
            name,
            model_type,
            path: path_str,
            parameters: None,
        })
    }

    pub fn infer(&self, _prompt: &str) -> Result<String> {
        // Placeholder for actual model inference
        // In a real implementation, this would call the actual model
        Ok("Model inference output".to_string())
    }

    pub fn info(&self) -> Result<String> {
        let info = format!(
            "Model Information:\n  Name: {}\n  Type: {}\n  Path: {}\n  Parameters: {}",
            self.name,
            self.model_type,
            self.path,
            self.parameters
                .map(|p| format!("{}M", p))
                .unwrap_or_else(|| "Unknown".to_string())
        );
        Ok(info)
    }
}
