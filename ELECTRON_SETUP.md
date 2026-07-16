# LLM Bench - Electron + React Windows App

Clean setup for building a professional Windows desktop application with Electron and React.

## 🎯 What We Have

- **Electron Main Process** (`public/main.js`) - Window management, IPC handlers
- **React Frontend** (`src/App.js`) - Professional UI with dark theme
- **IPC Communication** - Secure preload script for backend communication
- **Electron Builder** - Configured for Windows NSIS installer + portable builds
- **Professional UI** - Two-panel layout with configuration and results display

## 📦 Quick Start

### 1. Install Dependencies

```powershell
npm install
```

### 2. Development Mode

```powershell
npm run dev
```

This will:
- Start React dev server on `http://localhost:3000`
- Launch Electron app pointing to React dev server
- Enable hot reload for React changes

### 3. Build Windows App

```powershell
# Build installer + portable exe
npm run build-windows

# OR just portable executable
npm run build-portable
```

**Outputs:**
- `dist/LLM_Bench_0.2.0_x64-setup.exe` - Windows NSIS Installer
- `dist/LLM_Bench_0.2.0_x64.exe` - Portable executable

## 🏗️ Project Structure

```
.
├── public/
│   ├── main.js          # Electron main process
│   ├── preload.js       # IPC bridge (secure context)
│   └── index.html       # React HTML template
├── src/
│   ├── App.js          # Main React component
│   ├── App.css         # Component styling
│   ├── index.js        # React entry point
│   └── index.css       # Global styles
├── package.json        # Dependencies & build config
└── README.md
```

## 🔌 IPC Communication

### Available Electron APIs

From React component, use `window.electron`:

```javascript
// Run benchmark
await window.electron.runBenchmark({
  model: 'ollama:mistral',
  iterations: 5,
  dataset: 'standard',
  output: 'results.json'
});

// List available models
await window.electron.listModels();

// Get system information
await window.electron.getSystemInfo();

// Cancel running benchmark
await window.electron.cancelBenchmark();

// Listen for progress updates
window.electron.onBenchmarkProgress((data) => {
  console.log('Progress:', data);
});
```

## 🛠️ Next Steps

### 1. Connect Rust CLI Backend

The Electron app expects a compiled Rust CLI at:
```
src-cli/target/release/llm-bench
```

Build with:
```bash
cd src-cli
cargo build --release
```

### 2. Customize UI

Edit `src/App.js` to:
- Add more benchmark options
- Display results differently
- Add charts/visualizations
- Customize theme colors

### 3. Add Features

- Real-time system monitoring graphs
- Model comparison tables
- Benchmark history/logs
- Export results functionality

## 🚀 Deployment

### Windows NSIS Installer
```powershell
npm run build-windows
```

Creates professional Windows installer:
- Installation directory selector
- Desktop shortcut
- Start Menu entry
- Uninstall support

### Portable Executable
```powershell
npm run build-portable
```

Single `.exe` file - no installation needed, no registry changes.

### Code Signing (Optional)

For production, add code signing to `package.json`:

```json
"win": {
  "certificateFile": "path/to/cert.pfx",
  "certificatePassword": "password",
  "signingHashAlgorithms": ["sha256"]
}
```

## 📊 Performance Tips

1. **Async Operations**: All benchmark calls are async - never blocks UI
2. **Progress Updates**: Real-time logs via IPC event listeners
3. **Preload Security**: Context isolation prevents XSS attacks
4. **Native Modules**: Can use Node.js APIs in main process

## 🐛 Troubleshooting

### "Cannot find module" errors
```powershell
# Clean install
rm -r node_modules package-lock.json
npm install
```

### Electron not starting
```powershell
# Make sure CLI is built
cd src-cli
cargo build --release
cd ..

# Then start app
npm run dev
```

### Building hangs
- Use `npm run build-portable` for faster builds (no NSIS)
- Check Event Viewer for errors

## 📝 Notes

- Electron app runs on Node.js runtime with secure IPC to React frontend
- Preload script provides controlled access to Electron APIs
- CLI backend is separate process spawned by Electron
- All communication is async and non-blocking

**Ready to develop!** 🎉
