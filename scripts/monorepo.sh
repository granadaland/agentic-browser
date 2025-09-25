# choose your package dir (lowercase)
PKG_DIR="packages/browseros"
mkdir -p "$PKG_DIR"

# files/dirs we’ll MOVE under packages/browseros/
# -> adjust this list to your preference
MOVE_DIRS=(
  "build"
  "chromium_files"
  "chromium_patches"
  "patches"
  "resources"
  "pyproject.toml"
  "requirements.txt"
  "pyrightconfig.json"
  "CHROMIUM_VERSION"
)

# move the items that actually exist, preserving history (git mv)
for p in "${MOVE_DIRS[@]}"; do
  if [ -e "$p" ]; then
    git mv "$p" "$PKG_DIR"/
  else
    echo "skip: $p not found"
  fi
done

# commit the layout move as a single atomic change
git commit -m "chore(monorepo): move BrowserOS under $PKG_DIR (preserve history)"

