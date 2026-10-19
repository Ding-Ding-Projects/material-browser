"""Negative checks for pinned-source cookie patch receipt reconstruction."""
import difflib
import importlib.util
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("receipt", Path(__file__).with_name("refresh-cookie-receipt.py"))
receipt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(receipt)


class CookieReceiptTests(unittest.TestCase):
    baseline = "before\nkeep\nafter\n"
    result = "before\nchanged\nafter\n"

    def candidate(self):
        return "".join(difflib.unified_diff(
            self.baseline.splitlines(True), self.result.splitlines(True),
            fromfile="a/netwerk/cookie/input.cpp", tofile="b/netwerk/cookie/input.cpp"))

    def reconstruct(self, text, source=None):
        with patch.object(receipt.subprocess, "check_output", return_value=(source or self.baseline).encode("utf-8")):
            return receipt.patch_files(Path("."), text)

    def test_exact_reviewed_bytes_are_reconstructed(self):
        self.assertEqual(self.reconstruct(self.candidate()), {
            "netwerk/cookie/input.cpp": (self.baseline, self.result)})

    def test_modified_source_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "source context mismatch"):
            self.reconstruct(self.candidate(), "before\nother\nafter\n")

    def test_changed_hunk_length_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "hunk length mismatch"):
            self.reconstruct(self.candidate().replace("@@ -1,3 +1,3 @@", "@@ -1,9 +1,3 @@"))

    def test_unexpected_destination_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "destination mismatch"):
            self.reconstruct(self.candidate().replace("+++ b/netwerk/cookie/input.cpp", "+++ b/netwerk/other.cpp"))

    def test_path_escape_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unexpected"):
            self.reconstruct(self.candidate().replace("netwerk/cookie/input.cpp", "netwerk/../other.cpp"))

    def test_duplicate_file_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "duplicate"):
            self.reconstruct(self.candidate() * 2)


if __name__ == "__main__":
    unittest.main()
