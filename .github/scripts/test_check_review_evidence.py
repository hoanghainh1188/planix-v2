"""Tests for check-review-evidence.py (decision 2026-09-15-005-single-owner-branch-protection).

Run: python3 -m unittest discover -s .github/scripts -p 'test_*.py'
"""
from __future__ import annotations

import importlib.util
import os
import unittest

_SPEC = importlib.util.spec_from_file_location(
    "check_review_evidence", os.path.join(os.path.dirname(__file__), "check-review-evidence.py")
)
assert _SPEC and _SPEC.loader
check = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(check)

COMPLETE = """Part of #5

## Reviews
- **code-reviewer:** nothing blocking.
- **glossary-steward:** no drift.
- **security-reviewer:** one should-fix, done.

## Test plan
- [x] `npm run lint` — passes
- [x] `npm run test -- --coverage` — 448 tests
- [x] `npm run build` — passes
"""


class MissingEvidenceTest(unittest.TestCase):
    def test_complete_body_has_nothing_missing(self) -> None:
        self.assertEqual(check.missing_evidence(COMPLETE), [])

    def test_empty_or_absent_body_misses_everything(self) -> None:
        for body in ("", None):
            self.assertEqual(
                check.missing_evidence(body),
                ["code-reviewer", "glossary-steward", "security-reviewer", "test gate (npm run lint/test/build)"],
            )

    def test_each_review_is_required(self) -> None:
        for name in ("code-reviewer", "glossary-steward", "security-reviewer"):
            body = COMPLETE.replace(name, "someone")
            self.assertEqual(check.missing_evidence(body), [name], name)

    def test_test_gate_needs_lint_test_and_build(self) -> None:
        for command in ("npm run lint", "npm run test", "npm run build"):
            body = COMPLETE.replace(command, "npm run other")
            self.assertEqual(check.missing_evidence(body), ["test gate (npm run lint/test/build)"], command)

    def test_unticked_template_checkboxes_do_not_count(self) -> None:
        template = """## Chất lượng
- [ ] Đã chạy subagent `code-reviewer`, xử lý hết mục **Blocking**
- [ ] Đã chạy `glossary-steward` (term lệch đã sửa) và `security-reviewer`
- [ ] Test gate xanh: `npm run lint` / `npm run test` / `npm run build`
"""
        self.assertEqual(len(check.missing_evidence(template)), 4)

    def test_ticked_template_checkboxes_count(self) -> None:
        ticked = """## Chất lượng
- [x] Đã chạy subagent `code-reviewer`, xử lý hết mục **Blocking**
- [X] Đã chạy `glossary-steward` (term lệch đã sửa) và `security-reviewer`
- [x] Test gate xanh: `npm run lint` / `npm run test` / `npm run build`
"""
        self.assertEqual(check.missing_evidence(ticked), [])

    def test_names_are_matched_case_insensitively(self) -> None:
        self.assertEqual(check.missing_evidence(COMPLETE.upper()), [])


if __name__ == "__main__":
    unittest.main()
