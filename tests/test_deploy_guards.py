import os
import shutil
import subprocess
import tempfile
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class DeployGuardTests(unittest.TestCase):
    def test_account_deletion_route_is_rate_limited_before_proxying(self) -> None:
        site = (ROOT / "deploy/nginx-fiscalbay-oauth-site.conf").read_text()
        snippet = (ROOT / "deploy/nginx-fiscalbay-oauth.conf").read_text()

        self.assertIn("limit_req_zone $binary_remote_addr", site)
        for config in (site, snippet):
            location = config.split("location = /ebay/account-deletion", 1)[1]
            self.assertLess(location.index("limit_req zone="), location.index("proxy_pass "))

    def test_account_deletion_route_is_verified_by_the_deploy_smoke(self) -> None:
        smoke = (ROOT / "deploy/smoke-check.sh").read_text()

        self.assertIn('"${EBAY_ACCOUNT_DELETION_ENDPOINT_URL:-}"', smoke)
        self.assertIn('"${HUB_FATTURE_EBAY_ACCOUNT_DELETION_URL:-}"', smoke)
        self.assertIn('"fiscalbay-deploy-smoke"', smoke)
        self.assertIn("urllib.request.urlopen(", smoke)

    def test_major_release_requires_explicit_version_and_bump(self) -> None:
        release_script = (ROOT / "scripts/release_now.sh").read_text()

        self.assertIn(
            "next_version_tuple[0] > current_version[0]",
            release_script,
        )
        self.assertIn(
            "usa insieme --version X.Y.Z --bump major",
            release_script,
        )

    def test_privileged_units_cannot_execute_service_owned_code(self) -> None:
        deploy_script = (ROOT / "deploy/vps-deploy-ref.sh").read_text()
        setup_script = (ROOT / "deploy/linux-setup.sh").read_text()
        manual_deploy_script = (ROOT / "scripts/deploy_now.sh").read_text()
        secrets_check = (ROOT / "deploy/check-secrets-perms.sh").read_text()
        autodeploy_script = (ROOT / "deploy/autodeploy.sh").read_text()

        self.assertIn('chown -R root:"${APP_GROUP}" "${APP_DIR}"', deploy_script)
        self.assertIn('sudo chown -R root:"${APP_GROUP}" "${APP_DIR}"', setup_script)
        self.assertIn('sudo chown root:"${APP_GROUP}" "${ENV_FILE}"', setup_script)
        self.assertIn('sudo chmod 640 "${ENV_FILE}"', setup_script)
        self.assertNotIn('pip" install -e "${APP_DIR}"', setup_script)
        self.assertIn(
            'sudo "${PYTHON_BIN}" -m venv "${VENV_DIR}"',
            setup_script,
        )
        self.assertNotIn("staged_venv", setup_script)
        self.assertNotIn("/var/tmp/fiscalbay-venv", setup_script)
        self.assertIn('sudo chown -R root:"${APP_GROUP}" "${VENV_DIR}"', setup_script)
        self.assertNotIn('chown -R "${APP_USER}:${APP_GROUP}" "${VENV_DIR}"', setup_script)
        self.assertNotIn(
            'sudo -u "${APP_USER}" "${VENV_DIR}/bin/pip" install "${APP_DIR}"',
            setup_script,
        )
        self.assertIn('sudo "${VENV_DIR}/bin/pip"', setup_script)
        self.assertIn('sudo mv "${previous_venv}" "${VENV_DIR}"', setup_script)
        self.assertLess(
            setup_script.index('sudo systemctl stop "${active_timer_units[@]}"'),
            setup_script.index('for unit in "${oneshot_service_units[@]}"'),
        )
        self.assertLess(
            setup_script.index('sudo systemctl stop "${installed_long_running_units[@]}"'),
            setup_script.index('sudo "${PYTHON_BIN}" -m venv "${VENV_DIR}"'),
        )
        service_install_position = setup_script.index(
            '  install_service_file "${SERVICE_TEMPLATE}"'
        )
        self.assertLess(
            setup_script.index('unit_backup_dir="$(mktemp -d)"'),
            service_install_position,
        )
        self.assertLess(
            service_install_position,
            setup_script.index("\n  start_long_running_units\n", service_install_position),
        )
        self.assertIn(
            'sudo cp "${unit_backup}" "${unit_target}"',
            setup_script,
        )
        self.assertIn(
            '[[ "${unit_state}" == active || "${unit_state}" == activating ]]',
            setup_script,
        )
        self.assertNotIn('sudo systemctl stop "${oneshot_service_units[@]}"', setup_script)
        smoke_position = setup_script.index('bash "${APP_DIR}/deploy/smoke-check.sh"')
        self.assertLess(smoke_position, setup_script.index("trap - EXIT", smoke_position))
        self.assertLess(
            smoke_position, setup_script.index('sudo rm -rf "${previous_venv}"', smoke_position)
        )
        smoke_script = (ROOT / "deploy/smoke-check.sh").read_text()
        self.assertIn("SMOKE_CHECK_SKIP_BACKGROUND_UNITS:-false", smoke_script)
        self.assertIn("SMOKE_CHECK_SKIP_OAUTH_CHECK:-false", smoke_script)
        self.assertLess(
            setup_script.rindex("install_sqlite_dropins", 0, smoke_position), smoke_position
        )
        self.assertIn("restart_runtime_units || true", setup_script)
        self.assertIn('sudo tee "${RUNTIME_IDENTITY_FILE}"', setup_script)
        self.assertIn(
            '[ -f "${RUNTIME_IDENTITY_FILE}" ] && . "${RUNTIME_IDENTITY_FILE}"', secrets_check
        )
        for identity_consumer in (deploy_script, autodeploy_script):
            self.assertIn(
                '[ -f "${RUNTIME_IDENTITY_FILE}" ] && . "${RUNTIME_IDENTITY_FILE}"',
                identity_consumer,
            )
        self.assertIn('requested_app_user="${APP_USER:-}"', deploy_script)
        self.assertIn(
            'APP_USER="${requested_app_user:-${persisted_app_user:-fiscalbay}}"', deploy_script
        )
        self.assertIn('if [ -n "${requested_app_group}" ]', deploy_script)
        self.assertIn('APP_USER="${FISCALBAY_APP_USER:-}"', manual_deploy_script)
        self.assertIn('APP_GROUP="${FISCALBAY_APP_GROUP:-}"', manual_deploy_script)
        self.assertNotIn("APP_USER=${remote_app_user}", manual_deploy_script)
        restore_script = (ROOT / "deploy/restore.sh").read_text()
        self.assertIn('APP_GROUP="${APP_GROUP:-${APP_USER}}"', restore_script)
        self.assertIn('"root:${APP_GROUP}"', secrets_check)
        self.assertIn("BADOWNER", secrets_check)
        self.assertFalse((ROOT / "deploy/update.sh").exists())

    @unittest.skipIf(os.geteuid() == 0, "il test verifica il rifiuto per utenti non-root")
    def test_in_place_restore_requires_root(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            backup = Path(tmpdir) / "backup"
            (backup / "runtime").mkdir(parents=True)
            (backup / "runtime/.env").write_text("TOKEN=test\n")

            result = subprocess.run(
                ["bash", str(ROOT / "deploy/restore.sh"), str(backup), "--in-place"],
                capture_output=True,
                text=True,
            )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("richiede root", result.stderr)

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
            (bin_dir / "flock").write_text("#!/bin/sh\nexit 0\n")
            (app / "deploy" / "vps-deploy-ref.sh").write_text(
                '#!/bin/sh\nprintf "%s\\n" "$1" >> "$DEPLOY_LOG"\n'
                'test "${DEPLOY_EXIT:-0}" = 0 || exit "$DEPLOY_EXIT"\n'
                'mkdir -p "$FISCALBAY_AUTODEPLOY_STATE_DIR"\n'
                'printf "%s\\n" "$1" > "$FISCALBAY_AUTODEPLOY_STATE_DIR/deployed_sha"\n'
                'printf "%s\\n" "$1" > "$APP_DIR/.fiscalbay-deployed-sha"\n'
            )
            for script in (
                bin_dir / "curl",
                bin_dir / "flock",
                app / "deploy" / "vps-deploy-ref.sh",
            ):
                script.chmod(0o755)
            env = os.environ | {
                "APP_DIR": str(app),
                "DEPLOY_LOG": str(log),
                "FISCALBAY_AUTODEPLOY_STATE_DIR": str(state),
                "FISCALBAY_DEPLOY_ENV_FILE": str(root / "missing.env"),
                "FISCALBAY_DEPLOY_LOCK_FILE": str(root / "deploy.lock"),
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
            self.assertEqual((app / ".fiscalbay-deployed-sha").read_text().strip(), sha)

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
                '#!/bin/sh\nwhile [ "$#" -gt 0 ]; do\n'
                '  if [ "$1" = "-o" ]; then /bin/cp "$ARCHIVE_SOURCE" "$2"; exit; fi\n'
                "  shift\n"
                "done\n"
                'printf "%s" "$DEPLOY_SHA"\n'
            )
            (bin_dir / "chown").write_text("#!/bin/sh\nexit 0\n")
            for script in (bin_dir / "curl", bin_dir / "chown"):
                script.chmod(0o755)
            app.mkdir()
            victim = root / "victim"
            victim.write_text("unchanged")
            (app / ".fiscalbay-deployed-sha.tmp").symlink_to(victim)
            env = os.environ | {
                "APP_DIR": str(app),
                "APP_USER": "fiscalbay",
                "APP_GROUP": "fiscalbay",
                "ARCHIVE_SOURCE": str(archive),
                "DEPLOY_SHA": "b" * 40,
                "DEPLOY_LOG": str(log),
                "FISCALBAY_AUTODEPLOY_STATE_DIR": str(root / "state"),
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
            self.assertEqual((root / "state/deployed_sha").read_text().strip(), "b" * 40)
            self.assertEqual((app / ".fiscalbay-deployed-sha").read_text().strip(), "b" * 40)
            self.assertEqual(victim.read_text(), "unchanged")

    @unittest.skipUnless(shutil.which("flock"), "flock è disponibile sulla VPS e in CI Linux")
    def test_autodeploy_prevents_concurrent_state_updates(self) -> None:
        previous_sha = "a" * 40
        latest_sha = "b" * 40
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            app = root / "app"
            state = root / "state"
            bin_dir = root / "bin"
            (app / "deploy").mkdir(parents=True)
            state.mkdir()
            bin_dir.mkdir()
            (app / ".fiscalbay-deployed-sha").write_text(previous_sha)
            log = root / "deploy.log"
            failed_once = root / "failed-once"
            (bin_dir / "curl").write_text(f"#!/bin/sh\nprintf '%s' '{latest_sha}'\n")
            (app / "deploy/vps-deploy-ref.sh").write_text(
                '#!/bin/sh\nref="$1"\n'
                'if [ "$ref" = "$LATEST_SHA" ] && [ ! -e "$FAILED_ONCE" ]; then\n'
                '  touch "$FAILED_ONCE"\n'
                '  echo "$ref-fail" >> "$DEPLOY_LOG"\n'
                "  sleep 0.3\n"
                "  exit 1\n"
                "fi\n"
                'echo "$ref-ok" >> "$DEPLOY_LOG"\n'
                'printf "%s\\n" "$ref" > "$FISCALBAY_AUTODEPLOY_STATE_DIR/deployed_sha"\n'
                'printf "%s\\n" "$ref" > "$APP_DIR/.fiscalbay-deployed-sha"\n'
            )
            for script in (bin_dir / "curl", app / "deploy/vps-deploy-ref.sh"):
                script.chmod(0o755)
            env = os.environ | {
                "APP_DIR": str(app),
                "DEPLOY_LOG": str(log),
                "FAILED_ONCE": str(failed_once),
                "LATEST_SHA": latest_sha,
                "FISCALBAY_AUTODEPLOY_STATE_DIR": str(state),
                "FISCALBAY_DEPLOY_ENV_FILE": str(root / "missing.env"),
                "FISCALBAY_DEPLOY_LOCK_FILE": str(root / "deploy.lock"),
                "PATH": f"{bin_dir}:{os.environ['PATH']}",
            }
            command = ["bash", str(ROOT / "deploy/autodeploy.sh")]

            first = subprocess.Popen(command, env=env)
            for _ in range(50):
                if log.exists():
                    break
                time.sleep(0.02)
            second = subprocess.Popen(command, env=env)

            self.assertNotEqual(first.wait(), 0)
            self.assertEqual(second.wait(), 0)
            self.assertEqual(
                log.read_text().splitlines(),
                [f"{latest_sha}-fail", f"{previous_sha}-ok"],
            )
            self.assertEqual((state / "deployed_sha").read_text().strip(), previous_sha)
            self.assertEqual((app / ".fiscalbay-deployed-sha").read_text().strip(), previous_sha)

    @unittest.skipUnless(shutil.which("flock"), "flock è disponibile sulla VPS e in CI Linux")
    def test_autodeploy_loads_configured_lock_before_acquiring_it(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            app = root / "app"
            (app / "deploy").mkdir(parents=True)
            custom_lock = root / "custom.lock"
            ready = root / "ready"
            deploy_log = root / "deploy.log"
            deploy_env = root / "deploy.env"
            deploy_env.write_text(f"FISCALBAY_DEPLOY_LOCK_FILE={custom_lock}\n")
            (app / "deploy/vps-deploy-ref.sh").write_text(
                '#!/bin/sh\nprintf "deployed\\n" > "$DEPLOY_LOG"\n'
            )
            (app / "deploy/vps-deploy-ref.sh").chmod(0o755)
            holder = subprocess.Popen(
                [
                    "bash",
                    "-c",
                    'exec 8>"$1"; flock 8; touch "$2"; sleep 5',
                    "holder",
                    str(custom_lock),
                    str(ready),
                ]
            )
            try:
                for _ in range(50):
                    if ready.exists():
                        break
                    time.sleep(0.02)
                result = subprocess.run(
                    ["bash", str(ROOT / "deploy/autodeploy.sh")],
                    env=os.environ
                    | {
                        "APP_DIR": str(app),
                        "DEPLOY_LOG": str(deploy_log),
                        "FISCALBAY_DEPLOY_ENV_FILE": str(deploy_env),
                        "FISCALBAY_AUTODEPLOY_STATE_DIR": str(root / "state"),
                    },
                    capture_output=True,
                    text=True,
                    timeout=2,
                )
            finally:
                holder.terminate()
                holder.wait()

            self.assertEqual(result.returncode, 0)
            self.assertIn("deploy gia' in corso", result.stdout)
            self.assertFalse(deploy_log.exists())

    def test_lock_check_seeds_committed_pins(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            bin_dir = Path(tmpdir)
            uv = bin_dir / "uv"
            uv.write_text(
                '#!/bin/sh\nwhile [ "$1" != "-o" ]; do shift; done\ncmp "$COMMITTED_LOCK" "$2"\n'
            )
            uv.chmod(0o755)
            subprocess.run(
                ["make", "lock-check"],
                cwd=ROOT,
                env=os.environ
                | {
                    "COMMITTED_LOCK": str(ROOT / "requirements.lock"),
                    "PATH": f"{bin_dir}:{os.environ['PATH']}",
                },
                check=True,
            )

    def test_dependency_automation_covers_runtime_lock(self) -> None:
        makefile = (ROOT / "Makefile").read_text()
        dependency_review = (ROOT / ".github/workflows/dependency-review.yml").read_text()
        auto_merge = (ROOT / ".github/workflows/dependabot-auto-merge.yml").read_text()

        lock_command = makefile.split("lock:\n", 1)[1].split("lock-check:\n", 1)[0]
        self.assertIn("--upgrade", lock_command)
        self.assertIn('"requirements.lock"', dependency_review)
        self.assertIn('".github/workflows/dependency-review.yml"', dependency_review)
        self.assertIn("actions/setup-python@v7", dependency_review)
        self.assertIn('python-version: "3.13"', dependency_review)
        self.assertIn("pypa/gh-action-pip-audit@v1.1.0", dependency_review)
        self.assertIn("inputs: requirements.lock", dependency_review)
        self.assertIn("require-hashes: true", dependency_review)
        self.assertIn('"app/dependabot"', auto_merge)

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
