import os
import shutil
import subprocess
import tempfile
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class DeployGuardTests(unittest.TestCase):
    def test_autodeploy_records_only_a_successful_deploy(self) -> None:
        sha = "a" * 40
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            app = root / "app"
            state = root / "state"
            bin_dir = root / "bin"
            (app / "deploy").mkdir(parents=True)
            bin_dir.mkdir()
            log = root / "deploy.log"
            (bin_dir / "curl").write_text(f"#!/bin/sh\nprintf '%s' '{sha}'\n")
            (app / "deploy" / "vps-deploy-ref.sh").write_text(
                '#!/bin/sh\nprintf "%s\\n" "$1" >> "$DEPLOY_LOG"\nexit "${DEPLOY_EXIT:-0}"\n'
            )
            for script in (bin_dir / "curl", app / "deploy" / "vps-deploy-ref.sh"):
                script.chmod(0o755)
            env = os.environ | {
                "APP_DIR": str(app),
                "DEPLOY_LOG": str(log),
                "FISCALBAY_AUTODEPLOY_STATE_DIR": str(state),
                "FISCALBAY_DEPLOY_ENV_FILE": str(root / "missing.env"),
                "PATH": f"{bin_dir}:{os.environ['PATH']}",
            }

            failed = subprocess.run(
                ["bash", str(ROOT / "deploy/autodeploy.sh")],
                env=env | {"DEPLOY_EXIT": "1"},
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(failed.returncode, 0)
            self.assertFalse((state / "deployed_sha").exists())

            subprocess.run(
                ["bash", str(ROOT / "deploy/autodeploy.sh")],
                env=env,
                check=True,
                capture_output=True,
                text=True,
            )
            self.assertEqual((state / "deployed_sha").read_text().strip(), sha)

    @unittest.skipUnless(shutil.which("flock"), "flock è disponibile sulla VPS e in CI Linux")
    def test_shared_deploy_lock_serializes_deploys(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            source = root / "source"
            app = root / "app"
            bin_dir = root / "bin"
            log = root / "deploy.log"
            (source / "repo/deploy").mkdir(parents=True)
            bin_dir.mkdir()
            (source / "repo/deploy/install-vps.sh").write_text(
                '#!/bin/sh\necho start >> "$DEPLOY_LOG"\nsleep 0.4\necho end >> "$DEPLOY_LOG"\n'
            )
            archive = root / "repo.tar.gz"
            subprocess.run(["tar", "-czf", archive, "-C", source, "repo"], check=True)
            (bin_dir / "curl").write_text(
                '#!/bin/sh\nwhile [ "$1" != "-o" ]; do shift; done\n'
                '/bin/cp "$ARCHIVE_SOURCE" "$2"\n'
            )
            (bin_dir / "chown").write_text("#!/bin/sh\nexit 0\n")
            for script in (bin_dir / "curl", bin_dir / "chown"):
                script.chmod(0o755)
            env = os.environ | {
                "APP_DIR": str(app),
                "APP_USER": "fiscalbay",
                "APP_GROUP": "fiscalbay",
                "ARCHIVE_SOURCE": str(archive),
                "DEPLOY_LOG": str(log),
                "FISCALBAY_DEPLOY_LOCK_FILE": str(root / "deploy.lock"),
                "FISCALBAY_VPS_HOSTNAME": subprocess.check_output(["hostname"], text=True).strip(),
                "PATH": f"{bin_dir}:{os.environ['PATH']}",
            }
            command = ["bash", str(ROOT / "deploy/vps-deploy-ref.sh"), "main"]

            first = subprocess.Popen(command, env=env)
            for _ in range(50):
                if log.exists():
                    break
                time.sleep(0.02)
            second = subprocess.Popen(command, env=env)
            time.sleep(0.1)
            self.assertEqual(log.read_text().splitlines(), ["start"])
            self.assertEqual(first.wait(), 0)
            self.assertEqual(second.wait(), 0)
            self.assertEqual(log.read_text().splitlines(), ["start", "end", "start", "end"])

    def test_ci_fails_when_uv_is_missing(self) -> None:
        bash = shutil.which("bash")
        self.assertIsNotNone(bash)
        with tempfile.TemporaryDirectory() as empty_path:
            result = subprocess.run(
                [bash, str(ROOT / "scripts/ci_verify.sh")],
                env=os.environ | {"PATH": empty_path},
                capture_output=True,
                text=True,
            )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("uv e' richiesto", result.stderr)
        workflow = (ROOT / ".github/workflows/ci.yml").read_text()
        self.assertIn("pip install --upgrade pip uv", workflow)


if __name__ == "__main__":
    unittest.main()
