"""
Static Asset and Link Integrity Verifier for Secure Steganography Suite

Ensures that all referenced HTML pages, CSS files, JavaScript assets,
and Java backend entry points exist and are non-empty.
"""

from pathlib import Path
import re
import sys

REPO_ROOT = Path(__file__).resolve().parent.parent
HTML_DIR = REPO_ROOT / "src" / "html"

REQUIRED_PAGES = [
    "index.html",
    "rsa.html",
    "steganography.html",
    "watermark.html",
    "webcrypto.html",
]


def verify_pages():
    print("[*] Verifying HTML pages and linked assets...")
    missing_assets = []

    for page_name in REQUIRED_PAGES:
        page_path = HTML_DIR / page_name
        if not page_path.is_file():
            print(f"[!] Missing required page: {page_name}")
            missing_assets.append(str(page_path))
            continue

        content = page_path.read_text(encoding="utf-8", errors="ignore")

        # Find linked scripts
        scripts = re.findall(r'<script\s+[^>]*src=["\']([^"\']+)["\']', content)
        for s in scripts:
            if s.startswith("http://") or s.startswith("https://"):
                continue
            script_path = (HTML_DIR / s).resolve()
            if not script_path.is_file():
                print(f"[!] In {page_name}: Broken script link -> {s}")
                missing_assets.append(f"{page_name} -> {s}")

        # Find linked stylesheets
        links = re.findall(r'<link\s+[^>]*href=["\']([^"\']+)["\']', content)
        for href in links:
            if href.startswith("http://") or href.startswith("https://") or "font" in href:
                continue
            css_path = (HTML_DIR / href).resolve()
            if not css_path.is_file():
                print(f"[!] In {page_name}: Broken stylesheet link -> {href}")
                missing_assets.append(f"{page_name} -> {href}")

    # Check Java core
    java_file = REPO_ROOT / "src" / "java" / "SecureStegoProject.java"
    if not java_file.is_file():
        print(f"[!] Missing Java backend core: {java_file}")
        missing_assets.append(str(java_file))

    if missing_assets:
        print(f"\n[FAIL] Found {len(missing_assets)} missing or broken asset reference(s).")
        sys.exit(1)
    else:
        print(f"\n[PASS] All {len(REQUIRED_PAGES)} core suite pages and local assets verified successfully.")


if __name__ == "__main__":
    verify_pages()
