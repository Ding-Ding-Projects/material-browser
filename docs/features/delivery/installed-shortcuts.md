# Installed shortcuts

The Squirrel installer invokes the application with maintenance flags while installing,
updating or uninstalling. The main process handles these events before opening a workspace,
parsing workspace arguments or starting the native host.

Install and update events ask the adjacent installed `Update.exe` to create shortcuts for
`MaterialBrowser.exe`. Uninstall asks that updater to remove them. The obsolete-version
event exits without opening a workspace. Normal launches and `--squirrel-firstrun` retain
the productive startup path. Windows shell identity is
`com.squirrel.MaterialBrowser.MaterialBrowser`, matching the package and executable names.

The updater path is derived from the running executable in an `app-<version>` directory,
never from renderer input or a maintenance argument. It is invoked without a shell. A
missing updater, invalid installation layout, spawn error, nonzero exit or signal reports
an incomplete maintenance result. After ten seconds the application requests termination
of its own updater child and exits unsuccessfully; this does not prove descendant teardown.
The diagnostic contains only an approved code, without private installation paths.

Fourteen focused startup/security tests passed, including a regression that first failed
when maintenance opened a workspace and the shell identity was absent. Unit tests cover
shortcut arguments, missing updater, timeout ordering and late completion. The normal
desktop test entrypoint includes the maintenance tests.

Source verification does not establish installed shortcuts. Acceptance still requires a
new built installer, supported installation/update at a safe lifecycle boundary, Desktop
and Programs shortcut readback, and launch through the actual shortcut. Preserve existing
work, settings and authentication. Never force-close an active installation for this check.
