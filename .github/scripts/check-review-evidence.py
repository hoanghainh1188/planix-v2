#!/usr/bin/env python3
"""Kiểm mô tả Pull Request có bằng chứng review của pipeline `/design-to-code`.

Thay cho review của Code Owner thứ hai khi repo chỉ có một Code Owner
(decision 2026-09-15-005-single-owner-branch-protection). Mô tả PR phải nhắc tới
code-reviewer, glossary-steward, security-reviewer và test gate (npm run lint/test/build).
Checkbox chưa tick (`- [ ]`, VD từ PR template) không được tính là bằng chứng.

CI truyền mô tả PR qua biến môi trường PR_BODY:
    PR_BODY="$(gh pr view 12 --json body -q .body)" python3 .github/scripts/check-review-evidence.py

Chỉ dùng stdlib.
"""
from __future__ import annotations

import os
import re
import sys

REVIEWS = ("code-reviewer", "glossary-steward", "security-reviewer")
TEST_GATE = ("npm run lint", "npm run test", "npm run build")
TEST_GATE_LABEL = "test gate (npm run lint/test/build)"

_UNTICKED = re.compile(r"^\s*[-*]\s*\[ \]")


def missing_evidence(body: str | None) -> list[str]:
    """Names of the required evidence items that the PR description does not show."""
    lines = (body or "").splitlines()
    evidence = "\n".join(line for line in lines if not _UNTICKED.match(line)).lower()
    missing = [name for name in REVIEWS if name not in evidence]
    if not all(command in evidence for command in TEST_GATE):
        missing.append(TEST_GATE_LABEL)
    return missing


def main() -> int:
    missing = missing_evidence(os.environ.get("PR_BODY"))
    if missing:
        print("PR description is missing review evidence (decision 2026-09-15-005-single-owner-branch-protection):")
        for name in missing:
            print(f"  - {name}")
        return 1
    print("✓ PR description has review evidence")
    return 0


if __name__ == "__main__":
    sys.exit(main())
