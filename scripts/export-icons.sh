#!/bin/sh
# Exporte les tailles d'icônes depuis le logo validé (macOS, sips fourni).
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
source_logo="$project_dir/design/branding/grand-ciel-encre-source.png"
export_icon() {
  sips -z "$1" "$1" "$source_logo" --out "$project_dir/public/$2" >/dev/null
}
export_icon 180 apple-touch-icon.png
export_icon 192 app-icon-192.png
export_icon 512 app-icon-512.png
export_icon 32 favicon-32.png
export_icon 16 favicon-16.png
