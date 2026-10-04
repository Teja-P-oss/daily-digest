import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class FrontendContractTests(unittest.TestCase):
    def test_static_by_id_references_exist_in_page(self):
        """Keep JavaScript render targets in sync with the static page markup."""
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        page = (ROOT / "index.html").read_text(encoding="utf-8")

        referenced_ids = set(re.findall(r"byId\(['\"]([^'\"]+)['\"]\)", app))
        declared_ids = set(re.findall(r"\bid=['\"]([^'\"]+)['\"]", page))

        self.assertEqual(
            referenced_ids - declared_ids,
            set(),
            "app.js references elements that do not exist in index.html",
        )


if __name__ == "__main__":
    unittest.main()
