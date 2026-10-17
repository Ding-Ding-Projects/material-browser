# Automation and browser capabilities

Automation is opt-in for each profile. The stored choices are off, Selenium and Puppeteer. Off means no automation driver or debugging listener is requested.

## Requested and effective mode

Changing the preference on a running profile persists the requested choice but does not change its effective mode immediately. The application must display pending restart. Stop and relaunch through the normal workflow to apply the new choice, and require an actual capability and operation result.

An unsupported engine/mode combination must return an explicit capability error. A saved selection does not prove that a driver or endpoint exists. In particular, managed engine acquisition, patch integration, live snapshot protocols and automation endpoint availability need their own evidence.

The documentation's mode simulator changes only a local example. It never opens a driver, connects to an endpoint or launches a browser.
