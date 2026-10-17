"""Attach Selenium to the existing profile session through lan-webdriver.

Install selenium in your own client environment. Pass the relay's returned local
URL and sessionId. This example deliberately never requests a new driver session.
"""
import sys
from urllib.parse import urlparse
from selenium import webdriver

relay_url, owned_session = sys.argv[1:3]
url = urlparse(relay_url)
if url.scheme != "http" or url.hostname != "127.0.0.1":
    raise ValueError("Use the native relay's loopback URL")

class OwnedSession(webdriver.Remote):
    def start_session(self, capabilities):
        self.session_id = owned_session
        self.caps = {"browserName": "chrome"}

driver = OwnedSession(command_executor=relay_url, options=webdriver.ChromeOptions())
# Do not call quit here: the native host retains lifecycle ownership.
driver.get("https://example.com/")
print(driver.title)
