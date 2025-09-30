# Building BrowserOS

This guide will walk you through building BrowserOS from source.

## Prerequisites

### macOS
- macOS (tested on M4 Max)
- Xcode and Command Line Tools
- Python 3
- Git
- ~100GB of free disk space (for Chromium source)
- ~8GB RAM minimum (16GB+ recommended)

### Linux
- Ubuntu 20.04+ or similar
- build-essential package
- Python 3
- Git
- ~100GB of free disk space
- ~8GB RAM minimum (16GB+ recommended)

### Windows
- Windows 10/11
- Visual Studio 2022 with C++ workload
- Python 3
- Git
- ~100GB of free disk space
- ~16GB RAM minimum

## Build Instructions

### Step 1: Checkout Chromium

First, you need to get the Chromium source code. Follow the official Chromium instructions:

1. Visit the [Chromium Get the Code guide](https://www.chromium.org/developers/how-tos/get-the-code/)
2. Follow the platform-specific instructions to set up depot_tools and fetch Chromium
3. Note the path to your chromium/src directory (you'll need it for building)

### Step 2: Build BrowserOS

Navigate to the BrowserOS build system:

```bash
cd packages/browseros
```

#### Debug Build (for development):

```bash
# macOS
python build/build.py --config build/config/debug.macos.yaml --chromium-src /path/to/chromium/src --build

# Linux
python build/build.py --config build/config/debug.linux.yaml --chromium-src /path/to/chromium/src --build

# Windows
python build/build.py --config build/config/debug.windows.yaml --chromium-src /path/to/chromium/src --build
```

#### Release Build (for production):

```bash
# macOS
python build/build.py --config build/config/release.macos.yaml --chromium-src /path/to/chromium/src --build

# Linux
python build/build.py --config build/config/release.linux.yaml --chromium-src /path/to/chromium/src --build

# Windows
python build/build.py --config build/config/release.windows.yaml --chromium-src /path/to/chromium/src --build
```

**Note:** The build process typically takes 1-3 hours on modern hardware. Build times may vary based on your hardware specifications.

### Step 3: Run BrowserOS

After the build completes successfully, you can run BrowserOS:

#### macOS Debug Build:
```bash
# ARM64 (Apple Silicon)
out/Default_arm64/BrowserOS\ Dev.app/Contents/MacOS/BrowserOS\ Dev --user-data-dir=/tmp/test-profile

# x64 (Intel)
out/Default_x64/BrowserOS\ Dev.app/Contents/MacOS/BrowserOS\ Dev --user-data-dir=/tmp/test-profile
```

#### macOS Release Build:
```bash
# ARM64 (Apple Silicon)
out/Default_arm64/BrowserOS.app/Contents/MacOS/BrowserOS --user-data-dir=/tmp/test-profile

# x64 (Intel)
out/Default_x64/BrowserOS.app/Contents/MacOS/BrowserOS --user-data-dir=/tmp/test-profile
```

#### Linux and Windows:
The built binary will be located in the `out/Default_x64/` directory. Run it with the `--user-data-dir` flag to create an isolated test profile.

The `--user-data-dir` flag is useful for creating isolated test profiles during development.

## Troubleshooting

### Common Issues

1. **Build fails with missing dependencies**
   - Make sure you've followed all prerequisite steps from the Chromium build guide
   - Ensure Xcode is up to date

2. **Out of disk space**
   - Chromium requires significant disk space (~100GB)

### Getting Help

If you encounter issues:
- Join our [Discord](https://discord.gg/YKwjt5vuKr) for community support
- Check existing issues on GitHub
- Review the Chromium build documentation for platform-specific troubleshooting


Happy building! 🚀
