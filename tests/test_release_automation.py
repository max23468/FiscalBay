import importlib.util
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
GITHUB_RELEASE_PR_PATH = REPO_ROOT / "deploy" / "github-release-pr.py"
RELEASE_PLEASE_SCRIPT = REPO_ROOT / "deploy" / "release-please-pr.sh"


def load_github_release_pr_module():
    spec = importlib.util.spec_from_file_location("github_release_pr", GITHUB_RELEASE_PR_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Impossibile caricare github-release-pr.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class ReleaseAutomationTests(unittest.TestCase):
    def test_helper_rejects_unexpected_release_pr_files(self) -> None:
        module = load_github_release_pr_module()

        with self.assertRaises(module.GitHubError) as ctx:
            module.ensure_allowed_files(
                ["CHANGELOG.md", ".github/workflows/release.yml"],
                {"CHANGELOG.md", "pyproject.toml"},
            )

        self.assertIn("file inattesi", str(ctx.exception))

    def test_release_script_stops_when_no_release_pr_was_merged(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            app_dir = Path(tmpdir) / "app"
            deploy_dir = app_dir / "deploy"
            bin_dir = Path(tmpdir) / "bin"
            deploy_dir.mkdir(parents=True)
            bin_dir.mkdir()
            (app_dir / "release-please-config.json").write_text("{}\n", encoding="utf-8")
            (app_dir / ".release-please-manifest.json").write_text("{}\n", encoding="utf-8")
            (deploy_dir / "github-release-pr.py").write_text(
                "#!/usr/bin/env python3\n"
                'print(\'{"status": "no_release_pr", "release_branch": "release"}\')\n',
                encoding="utf-8",
            )
            (deploy_dir / "github-release-pr.py").chmod(0o755)
            (deploy_dir / "vps-deploy-ref.sh").write_text(
                "#!/usr/bin/env bash\necho deploy-called\n",
                encoding="utf-8",
            )
            (deploy_dir / "vps-deploy-ref.sh").chmod(0o755)
            (bin_dir / "node").write_text(
                '#!/usr/bin/env bash\nif [ "$1" = "-p" ]; then echo 20; else echo v20.0.0; fi\n',
                encoding="utf-8",
            )
            (bin_dir / "node").chmod(0o755)
            (bin_dir / "npx").write_text(
                '#!/usr/bin/env bash\necho "npx $*"\n',
                encoding="utf-8",
            )
            (bin_dir / "npx").chmod(0o755)

            env = {
                **os.environ,
                "APP_DIR": str(app_dir),
                "GITHUB_TOKEN": "token",
                "PATH": f"{bin_dir}{os.pathsep}{os.environ['PATH']}",
            }
            result = subprocess.run(
                ["bash", str(RELEASE_PLEASE_SCRIPT)],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Nessuna Release PR mergiata", result.stdout)
        self.assertNotIn("github-release", result.stdout)
        self.assertNotIn("deploy-called", result.stdout)


if __name__ == "__main__":
    unittest.main()
